/**
 * Helpers for journal entry account dropdowns — same source as Chart of Accounts (all active leaf + parent rows).
 */

export function normalizeJournalAccountGroupKey(account) {
  const raw = (account.accountType || account.type || '').trim();
  if (!raw) return 'Other';
  const r = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (r === 'Revenue') return 'Income';
  if (['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(r)) return r;
  return raw;
}

export function sortAccountsForJournalSelect(accounts) {
  if (!Array.isArray(accounts)) return [];
  return [...accounts].sort((a, b) => {
    const ca = (a.accountCode ?? a.code ?? '').toString();
    const cb = (b.accountCode ?? b.code ?? '').toString();
    return ca.localeCompare(cb, undefined, { numeric: true });
  });
}

export function groupAccountsForJournalSelect(accounts) {
  const sorted = sortAccountsForJournalSelect(accounts);
  return sorted.reduce((groups, account) => {
    const type = normalizeJournalAccountGroupKey(account);
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {});
}

export function journalAccountOptionLabel(account) {
  const code = (account.accountCode ?? account.code ?? '').toString().trim();
  const name = (account.accountName ?? account.name ?? '').toString().trim();
  const parent = account.parentAccount;
  const parentCode = parent
    ? (parent.accountCode ?? parent.code ?? '').toString().trim()
    : '';
  const base =
    code && name ? `${code} - ${name}` : code || name || `Account ${(account.id || '').slice(-8)}`;
  if (parentCode && parentCode !== code) {
    return `↳ ${base}`;
  }
  return base;
}
