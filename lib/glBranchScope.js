/**
 * GL / CoA branch scope: current branch plus tenant-wide (null branchId) postings.
 * Matches income-statement semantics — never exclusive branchId alone (that drops unassigned journals).
 *
 * Spread `.where` into Prisma journal/transaction filters only.
 * Use `.branchId` for inventory alignment and V2 summary options.
 */

/**
 * @param {string|null|undefined} currentBranchId
 * @returns {{ branchId: string|null, where: Record<string, unknown> }}
 */
export function resolveGlBranchScope(currentBranchId) {
  const branchId =
    currentBranchId != null && String(currentBranchId).trim() !== ''
      ? String(currentBranchId).trim()
      : null;
  if (!branchId) {
    return { branchId: null, where: {} };
  }
  return {
    branchId,
    where: { OR: [{ branchId }, { branchId: null }] },
  };
}
