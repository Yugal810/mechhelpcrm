import { createSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const garageId = Array.isArray(id) ? id[0] : id;

  if (!garageId) {
    return res.status(400).json({ error: 'Missing garage id parameter' });
  }

  const supabase = createSupabaseAdmin();

  try {
    const now = new Date().toISOString();
    const { amount, direction, currentBalance } = req.body || {};

    if (amount !== undefined && amount !== null) {
      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ error: 'Invalid payment amount' });
      }

      const signedAmount = Math.abs(paymentAmount);
      let netAmount = 0;
      if (direction === 'mechhelp_to_garage') {
        netAmount = signedAmount;
      } else if (direction === 'garage_to_mechhelp') {
        netAmount = -signedAmount;
      } else {
        const bal = Number(currentBalance) || 0;
        netAmount = bal > 0 ? -signedAmount : signedAmount;
      }

      const { data, error } = await supabase
        .from('garage_settlements')
        .insert({
          garage_id: garageId,
          billing_id: null,
          lead_id: null,
          net_amount: netAmount,
          settled: true,
          settled_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: `Successfully recorded payment of ₹${signedAmount}.`,
        settlement: data,
      });
    }

    const { data, error } = await supabase
      .from('garage_settlements')
      .update({
        settled: true,
        settled_at: now,
      })
      .eq('garage_id', garageId)
      .eq('settled', false)
      .select('*');

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: `Successfully settled all entries for garage.`,
      count: data?.length || 0,
      settledEntries: data,
    });
  } catch (error) {
    console.error('Settle garage failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
