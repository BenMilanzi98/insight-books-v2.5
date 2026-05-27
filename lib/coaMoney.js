import { MONEY_TOLERANCE, roundMoney } from '@/lib/money';

/** CoA / GL display rounding — single rounding point to limit float drift. */
export const COA_RECONCILE_TOLERANCE = MONEY_TOLERANCE;

/**
 * Prefer GL account **type** over stored `normalBalance` when they disagree (fixes wrong signs on chart).
 * @param {{ accountType?: string|null, type?: string|null, normalBalance?: string|null }} account
 * @returns {'Debit'|'Credit'}
 */
export function inferCoaNormalBalance(account) {
  const raw = String(account?.accountType ?? account?.type ?? '').trim();
  const t = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (t === 'Asset' || t === 'Expense') return 'Debit';
  if (
    t === 'Liability' ||
    t === 'Equity' ||
    t === 'Income' ||
    t === 'Revenue'
  ) {
    return 'Credit';
  }
  const nb = String(account?.normalBalance ?? '').trim();
  if (nb === 'Debit' || nb === 'Credit') return nb;
  return 'Debit';
}

/** @deprecated Use roundMoney from @/lib/money */
export function roundCents(n) {
  return roundMoney(n);
}
