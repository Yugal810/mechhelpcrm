import { createClient } from '@supabase/supabase-js';
import type { DailyQuicksLeadInput } from '../shared/dailyQuicks/types.js';

export function createSupabaseAdmin() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = rawUrl?.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  // FIX: Never fall back to the anon key for cron jobs — the service role key
  // bypasses RLS and is required so fetchLeadsForSummary returns all rows.
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

export async function fetchLeadsForSummary(): Promise<DailyQuicksLeadInput[]> {
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

export async function getDailySummaryByDate(date: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('daily_summaries')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertDailySummary(
  summary: import('../shared/dailyQuicks/types.js').DailyQuicksSummary
) {
  const supabase = createSupabaseAdmin();
  const generatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('daily_summaries')
    .upsert(
      // FIX: Always write email_sent: false on upsert so the cron can detect
      // a record that was saved but whose email delivery previously failed.
      { date: summary.date, summary, generated_at: generatedAt, email_sent: false },
      { onConflict: 'date' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/** Called after a successful email send to mark the record complete. */
export async function markEmailSent(date: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from('daily_summaries')
    .update({ email_sent: true })
    .eq('date', date);

  if (error) throw error;
}
