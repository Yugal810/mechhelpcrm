import { createSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { calculateSettlement } from '../../shared/settlementCalculator.js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { booking_id, line_items, paid_to, discount } = req.body;

  if (!booking_id) {
    return res.status(400).json({ error: 'Missing booking_id' });
  }
  if (!line_items || !Array.isArray(line_items)) {
    return res.status(400).json({ error: 'Missing or invalid line_items' });
  }
  if (!paid_to || (paid_to !== 'garage' && paid_to !== 'mechhelp')) {
    return res.status(400).json({ error: 'Invalid paid_to value. Must be "garage" or "mechhelp"' });
  }

  const supabase = createSupabaseAdmin();

  try {
    // 1. Fetch the lead (booking) to get details — include garage_assigned text for fallback lookup
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, garage_id, garage_assigned, customer_name')
      .eq('id', booking_id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // 2. Resolve garage_id — may be null for bookings created before the garage_id backfill ran.
    //    If null, attempt to match the garage by its text name (case-insensitive) and patch it back.
    let resolvedGarageId = lead.garage_id ?? null;

    if (!resolvedGarageId && lead.garage_assigned) {
      const { data: garageByName, error: garageNameError } = await supabase
        .from('garages')
        .select('id, name')
        .ilike('name', lead.garage_assigned.trim())
        .maybeSingle();

      if (garageNameError) throw garageNameError;

      if (garageByName) {
        resolvedGarageId = garageByName.id;
        // Patch garage_id back onto the lead so future calls don't need this lookup
        await supabase
          .from('leads')
          .update({ garage_id: resolvedGarageId })
          .eq('id', booking_id);
      }
    }

    if (!resolvedGarageId) {
      const garageName = lead.garage_assigned ? `"${lead.garage_assigned}"` : '(none)';
      return res.status(400).json({
        error: `Booking garage ${garageName} could not be matched to a known garage. Please check the garage name or re-assign the booking before completing it.`,
      });
    }

    // 3. Prevent double billing
    const { data: existingBilling, error: billCheckError } = await supabase
      .from('booking_billing')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle();

    if (billCheckError) throw billCheckError;
    if (existingBilling) {
      return res.status(400).json({ error: 'Billing is already finalized for this booking.' });
    }

    // 4. Compute totals (including discount absorbed by MechHelp)
    const calcResult = calculateSettlement(
      line_items.map((item) => ({
        name: item.name,
        amount: Number(item.amount) || 0,
        splitEnabled: !!item.splitEnabled,
        mechhelpPct: Number(item.mechhelpPct) ?? 20,
        garagePct: Number(item.garagePct) ?? 80,
      })),
      paid_to,
      Number(discount) || 0
    );

    // 5. Create booking_billing
    const { data: billing, error: billingError } = await supabase
      .from('booking_billing')
      .insert({
        booking_id,
        lead_id: booking_id,
        garage_id: resolvedGarageId,
        total_amount: calcResult.totalAmount,
        discount: calcResult.discount,
        paid_to,
        status: 'finalized',
      })
      .select('*')
      .single();

    if (billingError) throw billingError;

    // 6. Create billing_line_items
    if (line_items.length > 0) {
      const lineItemInserts = line_items.map((item) => ({
        billing_id: billing.id,
        name: item.name,
        amount: Number(item.amount) || 0,
        split_enabled: !!item.splitEnabled,
        mechhelp_pct: Number(item.mechhelpPct) ?? 20,
        garage_pct: Number(item.garagePct) ?? 80,
      }));

      const { error: lineItemsError } = await supabase
        .from('billing_line_items')
        .insert(lineItemInserts);

      if (lineItemsError) throw lineItemsError;
    }

    // 7. Create garage_settlements row if gross amount > 0
    //    (skip truly ₹0 / warranty / free-service bookings — nothing to settle)
    //    Uses grossAmount (pre-discount) because the garage is owed its share regardless of discount.
    if (calcResult.grossAmount > 0) {
      const { error: settlementError } = await supabase
        .from('garage_settlements')
        .insert({
          garage_id: resolvedGarageId,
          billing_id: billing.id,
          lead_id: booking_id,
          net_amount: calcResult.netAmount,
          settled: false,
        });

      if (settlementError) throw settlementError;
    }

    // 8. Update lead status to Completed
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({ lead_type: 'Completed' })
      .eq('id', booking_id);

    if (updateLeadError) throw updateLeadError;

    return res.status(200).json({
      success: true,
      billing,
      calculations: calcResult,
    });
  } catch (error) {
    console.error('Finalize billing failed:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
