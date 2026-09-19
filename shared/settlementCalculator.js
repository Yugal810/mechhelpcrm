/**
 * Calculates the split amounts and net balance for a booking settlement.
 *
 * Key semantics:
 * - `grossAmount`           = sum of line item amounts (pre-discount)
 * - `totalAmount`           = grossAmount − discount  (what the customer pays)
 * - `totalGarageEntitled`   = garage's split share from GROSS amounts (unaffected by discount)
 * - `totalMechhelpEntitled` = mechhelp's split share from GROSS amounts, THEN minus discount
 *
 * Discount is absorbed 100% by MechHelp:
 *   → Customer pays less; Garage still gets its full share; MechHelp absorbs the gap.
 *
 * paidTo 'garage'   → garage collected → net_amount = totalMechhelpEntitled (garage owes MechHelp)
 * paidTo 'mechhelp' → mechhelp collected → net_amount = −totalGarageEntitled (MechHelp owes Garage)
 */
export function calculateSettlement(
  lineItems,
  paidTo,
  discount = 0
) {
  let grossAmount = 0;
  let totalMechhelpEntitled = 0;
  let totalGarageEntitled = 0;

  for (const item of lineItems) {
    const amount = Number(item.amount) || 0;
    grossAmount += amount;

    if (item.splitEnabled) {
      const mhPct = Number(item.mechhelpPct) ?? 20;
      const gPct = Number(item.garagePct) ?? 80;
      totalMechhelpEntitled += amount * (mhPct / 100);
      totalGarageEntitled += amount * (gPct / 100);
    } else {
      // Split disabled: 100% of this item goes to the garage
      totalGarageEntitled += amount;
    }
  }

  // Discount: reduces what the customer pays AND absorbs into MechHelp's share
  const sanitizedDiscount = Math.max(0, Number(discount) || 0);
  const totalAmount = grossAmount - sanitizedDiscount;   // customer-facing
  totalMechhelpEntitled -= sanitizedDiscount;            // MechHelp eats the loss

  let netAmount = 0;
  if (paidTo === 'garage') {
    netAmount = totalMechhelpEntitled;
  } else if (paidTo === 'mechhelp') {
    netAmount = -totalGarageEntitled;
  }

  // Round to 2 decimal places to avoid floating-point noise
  return {
    grossAmount: Math.round(grossAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    discount: Math.round(sanitizedDiscount * 100) / 100,
    totalMechhelpEntitled: Math.round(totalMechhelpEntitled * 100) / 100,
    totalGarageEntitled: Math.round(totalGarageEntitled * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
  };
}
