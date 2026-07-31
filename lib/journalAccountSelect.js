/**
 * Helpers for journal entry account dropdowns — same source as Chart of Accounts (all active leaf + parent rows).
 */

import { isCoaSyntheticDirectRow } from '@/lib/coaChartRollup';

/** Real GL rows only: GET /api/chart-of-accounts may include synthetic “Direct postings” display children. */
export function filterCoaAccountsForPostingPicker(accounts) {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((a) => a?.id && !isCoaSyntheticDirectRow(a));
}

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

/**
 * Project account balance after a draft debit/credit line (signed by normal balance).
 */
export function projectAccountBalanceAfterLine(account, debit = 0, credit = 0) {
  const current = Number(account?.currentBalance) || 0;
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  const side = String(account?.normalBalanceSide || account?.normalBalance || 'Debit').toLowerCase();
  if (side.startsWith('c')) {
    return current + c - d;
  }
  return current + d - c;
}

/** Case-insensitive match on account code or name for journal pickers. */
export function accountMatchesJournalSearch(account, query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return true;
  const code = String(account?.accountCode ?? account?.code ?? '').toLowerCase();
  const name = String(account?.accountName ?? account?.name ?? '').toLowerCase();
  return code.includes(q) || name.includes(q);
}

/**
 * @param {object} account
 * @param {(n: number) => string} [formatBalance] optional balance formatter
 */
export function journalAccountOptionLabel(account, formatBalance) {
  const code = (account.accountCode ?? account.code ?? '').toString().trim();
  const name = (account.accountName ?? account.name ?? '').toString().trim();
  const parent = account.parentAccount;
  const parentCode = parent
    ? (parent.accountCode ?? parent.code ?? '').toString().trim()
    : '';
  const base =
    code && name ? `${code} - ${name}` : code || name || `Account ${(account.id || '').slice(-8)}`;
  const withParent = parentCode && parentCode !== code ? `↳ ${base}` : base;
  const ref = String(account.paymentAccountReference ?? '').trim();
  if (ref && !withParent.includes(ref)) {
    return `${withParent} · ${ref}`;
  }
  if (account.currentBalance != null && Number.isFinite(Number(account.currentBalance))) {
    const bal = Number(account.currentBalance);
    if (typeof formatBalance === 'function') {
      return `${withParent} · ${formatBalance(bal)}`;
    }
    return `${withParent} · Bal ${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return withParent;
}
