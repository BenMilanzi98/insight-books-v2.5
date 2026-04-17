/**
 * Shared GL reads for Budget & Forecast (posted activity).
 */

/** Matches Transaction (`posted`) and JournalEntry (`Posted`, legacy caps). */
export const POSTED_TX_STATUSES = ['posted', 'Posted', 'POSTED'];

/**
 * @param {boolean} branchScoped
 * @param {string | null | undefined} branchId
 */
export function transactionBranchFilter(branchScoped, branchId) {
  if (!branchScoped || !branchId) return {};
  return { OR: [{ branchId }, { branchId: null }] };
}

export function journalEntryBranchFilter(branchScoped, branchId) {
  if (!branchScoped || !branchId) return {};
  return { OR: [{ branchId }, { branchId: null }] };
}

/** @param {{ entryDate: Date|null, postedDate: Date|null }} je */
export function journalEntryEffectiveDate(je) {
  if (je.entryDate) return new Date(je.entryDate);
  if (je.postedDate) return new Date(je.postedDate);
  return null;
}
