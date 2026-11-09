export type DiscountRule = {
  kind: "Percent" | "Fixed";
  value: number;
  minSubtotal: number;
  maxAmount: number | null;
};

export function isDiscountEligible(rule: DiscountRule, subtotal: number) {
  return subtotal >= rule.minSubtotal;
}

// Percent discounts use whole percentages; fixed discounts are rupiah amounts.
export function calculateDiscountAmount(rule: DiscountRule, subtotal: number) {
  if (!isDiscountEligible(rule, subtotal)) return 0;
  const raw = rule.kind === "Percent" ? Math.floor(subtotal * rule.value / 100) : rule.value;
  const capped = rule.kind === "Percent" && rule.maxAmount !== null ? Math.min(raw, rule.maxAmount) : raw;
  return Math.min(capped, subtotal);
}

// Tax is calculated after the discount, so the discount reduces the taxable base.
export function calculateOrderTotals(subtotal: number, taxRateBasisPoints: number, discountAmount: number) {
  const taxableBase = subtotal - discountAmount;
  const tax = Math.round(taxableBase * taxRateBasisPoints / 10_000);
  return { subtotal, discountAmount, tax, total: taxableBase + tax };
}
