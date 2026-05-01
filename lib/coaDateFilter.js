/**
 * Chart-of-accounts date semantics:
 * - Balance sheet (Asset / Liability / Equity): cumulative through `dateTo` (ignore `dateFrom` for math).
 * - Income statement (Revenue / Expense): net activity in [effectiveFrom, dateTo] where
 *   effectiveFrom = dateFrom ?? start of financial year containing dateTo.
 */
import { startOfFinancialYearForDate } from '@/lib/accountingPeriodService';

/**
 * @param {Record<string, unknown>|null|undefined} account
 * @returns {'BS'|'IS'}
 */
export function accountClass(account) {
  const t = String(account?.accountType ?? account?.type ?? '')
    .trim()
    .toLowerCase();
  if (t === 'asset' || t === 'liability' || t === 'equity') return 'BS';
  if (t === 'revenue' || t === 'income' || t === 'expense') return 'IS';
  return 'BS';
}

/**
 * Effective posting date for a journal line (no createdAt fallback — avoids date bleed).
 * @param {{ journalEntry?: { entryDate?: Date|null, postedDate?: Date|null } }|null} line
 */
export function journalLineEffectiveDate(line) {
  const je = line?.journalEntry;
  if (!je) return null;
  if (je.entryDate != null) return je.entryDate instanceof Date ? je.entryDate : new Date(je.entryDate);
  if (je.postedDate != null) return je.postedDate instanceof Date ? je.postedDate : new Date(je.postedDate);
  return null;
}

/**
 * @param {{ from?: Date|null, to?: Date|null, invalid?: boolean }} dateRange — from `buildChartDateRange`
 * @param {number} fiscalYearStartMonth 1–12
 * @returns {{ effectiveFrom: Date|null, end: Date|null, hasFilter: boolean }}
 */
export function resolveCoaFilterBounds(dateRange, fiscalYearStartMonth = 1) {
  if (!dateRange || dateRange.invalid) {
    return { effectiveFrom: null, end: null, hasFilter: false };
  }
  const hasFilter = Boolean(dateRange.from || dateRange.to);
  if (!hasFilter) {
    return { effectiveFrom: null, end: null, hasFilter: false };
  }
  const end = dateRange.to || dateRange.from;
  if (!end) {
    return { effectiveFrom: null, end: null, hasFilter: false };
  }
  const fyStart = startOfFinancialYearForDate(end, fiscalYearStartMonth);
  const effectiveFrom = dateRange.from ?? fyStart;
  return { effectiveFrom, end, hasFilter: true };
}

/**
 * Whether a posted journal line counts for this survivor account's class and filter window.
 * @param {'BS'|'IS'} cls
 * @param {Date|null} eff — from journalLineEffectiveDate
 * @param {{ effectiveFrom: Date|null, end: Date|null, hasFilter: boolean }} bounds
 */
export function journalLineMatchesCoaFilter(cls, eff, bounds) {
  if (!eff || Number.isNaN(eff.getTime())) return false;
  if (!bounds.hasFilter) return true;
  const { end, effectiveFrom } = bounds;
  if (!end) return true;
  if (cls === 'BS') {
    return eff.getTime() <= end.getTime();
  }
  if (!effectiveFrom) return eff.getTime() <= end.getTime();
  return eff.getTime() >= effectiveFrom.getTime() && eff.getTime() <= end.getTime();
}

/**
 * @param {'BS'|'IS'} cls
 * @param {Date|null} txDate — Transaction.date
 * @param {{ effectiveFrom: Date|null, end: Date|null, hasFilter: boolean }} bounds
 */
export function transactionDateMatchesCoaFilter(cls, txDate, bounds) {
  if (!txDate || Number.isNaN(txDate.getTime())) return false;
  if (!bounds.hasFilter) return true;
  const { end, effectiveFrom } = bounds;
  if (!end) return true;
  if (cls === 'BS') {
    return txDate.getTime() <= end.getTime();
  }
  if (!effectiveFrom) return txDate.getTime() <= end.getTime();
  return txDate.getTime() >= effectiveFrom.getTime() && txDate.getTime() <= end.getTime();
}
