/**
 * Deep links from financial reports to Chart of Accounts / General Ledger sources.
 */

/**
 * @param {{ accountId?: string|null, accountCode?: string|null }} account
 * @returns {string|null}
 */
export function buildCoaAccountSourceHref(account) {
  const code = String(account?.accountCode ?? '').trim();
  if (code && !code.startsWith('cat:')) {
    return `/chart-of-accounts?search=${encodeURIComponent(code)}`;
  }
  const id = account?.accountId ?? account?.id ?? null;
  if (id) {
    return `/general-ledger?accountId=${encodeURIComponent(id)}`;
  }
  return null;
}
