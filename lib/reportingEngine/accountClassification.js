/**
 * Chart-of-Accounts classification for centralized reporting.
 * Uses account type, subtype, and code ranges — not hardcoded account names.
 */

import { isCoaStructuralRootCode } from '@/lib/coaPostingCodes.js';

const EPS = 1e-6;

export function normalizeAccountType(account) {
  const raw = String(account?.accountType ?? account?.type ?? '').trim();
  if (!raw) return 'Unknown';
  const upper = raw.toUpperCase();
  if (upper.includes('REVENUE') || upper.includes('INCOME')) return 'Income';
  if (upper.includes('EXPENSE')) return 'Expense';
  if (upper.includes('ASSET')) return 'Asset';
  if (upper.includes('LIABIL')) return 'Liability';
  if (upper.includes('EQUITY')) return 'Equity';
  if (upper.includes('COGS') || upper.includes('COST OF SALES')) return 'Expense';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export function accountCodeNumeric(code) {
  const m = String(code ?? '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : NaN;
}

export function isGroupHeaderAccount(account, parentIdsWithChildren) {
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  if (subtype === 'group') return true;
  if (isCoaStructuralRootCode(account?.accountCode ?? account?.code)) return true;
  if (parentIdsWithChildren?.has(account?.id) && account?.acceptsNewTransactions !== true) {
    return true;
  }
  return false;
}

export function isCostOfSalesAccount(account) {
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  if (
    subtype.includes('cost of sales') ||
    subtype.includes('cost of goods') ||
    subtype === 'cogs'
  ) {
    return true;
  }
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  const n = accountCodeNumeric(code);
  if (code === '5100' || code === '5002' || code === '5003') return true;
  if (Number.isFinite(n) && n >= 5100 && n < 5200) return true;
  return false;
}

export function isOperatingExpenseAccount(account) {
  if (normalizeAccountType(account) !== 'Expense') return false;
  if (isCostOfSalesAccount(account)) return false;
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  if (subtype.includes('other expense')) return false;
  return true;
}

export function isOtherExpenseAccount(account) {
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  return subtype.includes('other expense');
}

export function isIncomeAccount(account) {
  const type = normalizeAccountType(account);
  if (type === 'Income') return true;
  const n = accountCodeNumeric(account?.accountCode ?? account?.code);
  return Number.isFinite(n) && n >= 4100 && n < 5000;
}

export function isOtherIncomeAccount(account) {
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  return subtype.includes('other income');
}

export function isAssetAccount(account) {
  return normalizeAccountType(account) === 'Asset';
}

export function isLiabilityAccount(account) {
  return normalizeAccountType(account) === 'Liability';
}

export function isEquityAccount(account) {
  return normalizeAccountType(account) === 'Equity';
}

export function isTaxInflowAccount(account) {
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  return code.startsWith('2041');
}

export function isTaxOutflowAccount(account) {
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  return code.startsWith('2045');
}

export function isInventoryAssetAccount(account) {
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  const code = String(account?.accountCode ?? account?.code ?? '').trim();
  const name = String(account?.accountName ?? account?.name ?? '').toLowerCase();
  if (!isAssetAccount(account)) return false;
  return (
    code.startsWith('13') ||
    subtype.includes('inventory') ||
    name.includes('inventory')
  );
}

export function isInventoryLossAccount(account) {
  if (!isOperatingExpenseAccount(account) && normalizeAccountType(account) !== 'Expense') {
    const nameOnly = String(account?.accountName ?? account?.name ?? '').toLowerCase();
    return nameOnly.includes('inventory adjustment loss') || nameOnly.includes('inventory loss');
  }
  const name = String(account?.accountName ?? account?.name ?? '').toLowerCase();
  const subtype = String(account?.accountSubtype ?? '').trim().toLowerCase();
  return (
    name.includes('inventory adjustment loss') ||
    name.includes('inventory loss') ||
    subtype.includes('inventory loss')
  );
}

/**
 * Period net movement for P&L display (always positive magnitude for the section).
 * @param {{ normalBalance?: string, accountType?: string, type?: string }} account
 */
export function computePeriodNetMovement(account, debitTotal, creditTotal) {
  const debit = Number(debitTotal) || 0;
  const credit = Number(creditTotal) || 0;
  const type = normalizeAccountType(account);
  const normal = String(
    account?.normalBalance ??
      (type === 'Asset' || type === 'Expense' ? 'Debit' : 'Credit')
  ).toLowerCase();

  if (normal === 'debit') {
    return debit - credit;
  }
  return credit - debit;
}

/**
 * Cumulative balance as-of for balance sheet display (signed, debit-positive for assets/expenses).
 */
export function computeBalanceSheetAmount(account, debitTotal, creditTotal) {
  return computePeriodNetMovement(account, debitTotal, creditTotal);
}

export function hasMeaningfulAmount(amount) {
  return Math.abs(Number(amount) || 0) > EPS;
}

export function roundReportAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
