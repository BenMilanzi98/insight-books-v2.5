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

/** Reserved system equity code — opening balance counter-account (not a capital contribution sub). */
export const OPENING_BALANCE_EQUITY_CODE = '3190';

/**
 * Credit-normal account types where UI/report balances must not show negative amounts owed.
 * @param {{ accountType?: string|null, type?: string|null, normalBalance?: string|null }} account
 */
export function isCreditNormalDisplayAccount(account) {
  const raw = String(account?.accountType ?? account?.type ?? '').trim().toLowerCase();
  if (
    raw.includes('liabil') ||
    raw.includes('equity') ||
    raw.includes('revenue') ||
    raw.includes('income')
  ) {
    return true;
  }
  return inferCoaNormalBalance(account) === 'Credit';
}

/** Tax outflow GL codes (2045-xx) — paid/recoverable tax; always display as positive magnitude. */
export function isTaxOutflowGlCode(accountCode) {
  const code = String(accountCode ?? '').trim();
  return code === '2045' || code.startsWith('2045-');
}

/**
 * Normalize signed natural balance for chart/report display.
 * Liabilities, equity, and revenue never show negative; tax outflow always positive.
 */
export function displayNaturalAccountBalance(account, signedBalance) {
  const n = Number(signedBalance) || 0;
  const code = account?.accountCode ?? account?.code;
  if (isTaxOutflowGlCode(code)) {
    return Math.max(0, Math.abs(n));
  }
  if (isCreditNormalDisplayAccount(account)) {
    return Math.max(0, n);
  }
  return n;
}

/** Paid tax amounts (expenses, GL input tax) must never display as negative. */
export function displayTaxPaidAmount(amount) {
  return Math.max(0, Math.abs(Number(amount) || 0));
}

/**
 * Apply display normalization to chart API account rows (mutates in place).
 * @param {Array<Record<string, unknown>>} accounts
 */
export function normalizeCoaDisplayBalances(accounts) {
  if (!Array.isArray(accounts)) return accounts;
  for (const row of accounts) {
    const fields = ['currentBalance', 'postedDirectBalance', 'journalEntryBalance', 'postedGlNet'];
    for (const key of fields) {
      if (row[key] != null) {
        row[key] = roundMoney(displayNaturalAccountBalance(row, row[key]));
      }
    }
  }
  return accounts;
}
