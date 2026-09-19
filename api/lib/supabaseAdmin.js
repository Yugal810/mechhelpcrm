import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) must be configured for Daily Quicks cron');
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be configured for Daily Quicks cron. ' +
      'The anon key is not safe to use here — it may return incomplete data due to RLS.'
    );
  }

  return createClient(url, key);
}

export async function fetchLeadsForSummary() {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from('leads')
    .select(`
      customer_name,
      identifier,
      lead_type,
      booking_date_time,
      next_follow_up_date,
      garage_notified,
      is_vip,
      booking_history(id)
    `)
    .order('created_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    customerName: row.customer_name,
    identifier: row.identifier,
    leadType: row.lead_type,
    bookingDateTime: row.booking_date_time ?? undefined,
    nextFollowUpDate: row.next_follow_up_date,
    garageNotified: row.garage_notified,
    isVip: row.is_vip,
    bookingHistory: row.booking_history ?? [],
  }));
}

export async function getDailySummaryByDate(date) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertDailySummary(summary) {
  const supabase = createSupabaseAdmin();
  const generatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('daily_summaries')
    .upsert(
      { date: summary.date, summary, generated_at: generatedAt, email_sent: false },
      { onConflict: 'date' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function markEmailSent(date) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from('daily_summaries')
    .update({ email_sent: true })
    .eq('date', date);

  if (error) throw error;
}
