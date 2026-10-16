/**
 * Money helpers.
 *
 * Amounts are currently stored as floating point numbers (moving the schema to
 * integer santim is tracked separately, because it needs a data backfill).
 * Until then every amount that is written to the database goes through
 * `roundMoney`, so values stay exact to the cent and never carry floating point
 * artefacts such as `0.30000000000000004`.
 */

/** VAT rate applied to orders. */
export const TAX_RATE = 0.15;

/** Round to 2 decimal places (santim), free of float artefacts. */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Normalise an untrusted money input (form field, request body).
 * Returns null when the value cannot be used as an amount.
 */
export function parseMoney(value: unknown): number | null {
  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  return roundMoney(raw);
}

export interface MoneyInput {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
}

/**
 * Compute order totals.
 *
 * The discount is applied to the subtotal *before* VAT, which is the expected
 * behaviour for a restaurant bill. A discount larger than the subtotal is
 * clamped rather than producing a negative total.
 */
export function computeOrderTotals(
  items: MoneyInput[],
  discount = 0,
  taxRate: number = TAX_RATE,
): OrderTotals {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const safeDiscount = Math.min(Math.max(roundMoney(discount), 0), subtotal);
  const taxable = roundMoney(subtotal - safeDiscount);
  const taxAmount = roundMoney(taxable * taxRate);
  const total = roundMoney(taxable + taxAmount);

  return { subtotal, discount: safeDiscount, taxAmount, total };
}
