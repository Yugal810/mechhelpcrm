import { createSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const garageId = Array.isArray(id) ? id[0] : id;

  if (!garageId) {
    return res.status(400).json({ error: 'Missing garage id parameter' });
  }

  const supabase = createSupabaseAdmin();

  try {
    const { data: garage, error: garageError } = await supabase
      .from('garages')
      .select('id, name')
      .eq('id', garageId)
      .maybeSingle();

    if (garageError) throw garageError;
    if (!garage) {
      return res.status(404).json({ error: 'Garage not found' });
    }

    const { data: settlements, error: settlementsError } = await supabase
      .from('garage_settlements')
      .select(`
        id,
        net_amount,
        settled,
        settled_at,
        created_at,
        leads (
          id,
          customer_name,
          booking_date_time,
          car_brand,
          car_model
        ),
        booking_billing (
          id,
          total_amount,
          paid_to,
          status,
          billing_line_items (
            id,
            name,
            amount,
            split_enabled,
            mechhelp_pct,
            garage_pct
          )
        )
      `)
      .eq('garage_id', garageId)
      .order('created_at', { ascending: false });

    if (settlementsError) throw settlementsError;

    let balance = 0;
    const formattedSettlements = (settlements || []).map((row) => {
      const isSettled = !!row.settled;
      const netAmount = Number(row.net_amount) || 0;
      balance += netAmount;

      return {
        id: row.id,
        netAmount,
        settled: isSettled,
        settledAt: row.settled_at,
        createdAt: row.created_at,
        customerName: row.leads?.customer_name || 'Unknown Customer',
        bookingDate: row.leads?.booking_date_time || row.created_at,
        carBrand: row.leads?.car_brand || '',
        carModel: row.leads?.car_model || '',
        billing: row.booking_billing ? {
          id: row.booking_billing.id,
          totalAmount: Number(row.booking_billing.total_amount),
          paidTo: row.booking_billing.paid_to,
          status: row.booking_billing.status,
          lineItems: (row.booking_billing.billing_line_items || []).map((item) => ({
            id: item.id,
            name: item.name,
            amount: Number(item.amount),
            splitEnabled: !!item.split_enabled,
            mechhelpPct: Number(item.mechhelp_pct),
            garagePct: Number(item.garage_pct)
          }))
        } : null
      };
    });

    return res.status(200).json({
      garage,
      balance: Math.round(balance * 100) / 100,
      settlements: formattedSettlements
    });
  } catch (error) {
    console.error('Fetch settlements failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
