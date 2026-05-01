/** CoA / GL display rounding — single rounding point to limit float drift. */
export const COA_RECONCILE_TOLERANCE = 0.005;

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

export function roundCents(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
