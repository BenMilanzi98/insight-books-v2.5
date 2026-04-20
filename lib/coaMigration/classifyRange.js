/**
 * Phase 2: numeric GL code range → type bucket (implementation guide).
 */

/** @param {string|null|undefined} code */
export function primaryNumericFromAccountCode(code) {
  if (code == null) return NaN;
  const s = String(code).trim();
  const m = s.match(/^(\d+)/);
  if (!m) return NaN;
  return parseInt(m[1], 10);
}

/**
 * @param {string|null|undefined} accountCode
 * @returns {'Asset'|'Liability'|'Equity'|'Revenue'|'Expense'|'UNCLASSIFIED'}
 */
export function classifyCoaBucketByCode(accountCode) {
  const raw = String(accountCode ?? '').trim();
  // Canonical capital parent (blueprint) sits outside 3000–3999 numerically but is Equity.
  if (raw === '500000') return 'Equity';

  const n = primaryNumericFromAccountCode(accountCode);
  if (!Number.isFinite(n)) return 'UNCLASSIFIED';
  if (n >= 1000 && n <= 1999) return 'Asset';
  if (n >= 2000 && n <= 2999) return 'Liability';
  if (n >= 3000 && n <= 3999) return 'Equity';
  if (n >= 4000 && n <= 4999) return 'Revenue';
  if (n >= 5000 && n <= 5999) return 'Expense';
  return 'UNCLASSIFIED';
}
