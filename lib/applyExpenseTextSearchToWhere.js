/**
 * Attach expense text search to a Prisma `where` object without clobbering an existing
 * top-level `OR` from `addBranchFilterIncludeUnassigned` (branch OR unassigned).
 *
 * @param {Record<string, unknown>} whereClause - mutated in place
 * @param {string | null | undefined} rawSearch
 */
export function applyExpenseTextSearchToWhere(whereClause, rawSearch) {
  const q = (rawSearch || '').trim();
  if (!q) return;

  const searchOr = [
    { description: { contains: q, mode: 'insensitive' } },
    { category: { contains: q, mode: 'insensitive' } },
    { merchant: { contains: q, mode: 'insensitive' } },
  ];

  if (whereClause.OR) {
    const branchOr = whereClause.OR;
    delete whereClause.OR;
    const existingAnd = Array.isArray(whereClause.AND) ? [...whereClause.AND] : [];
    whereClause.AND = [{ OR: branchOr }, { OR: searchOr }, ...existingAnd];
  } else {
    whereClause.OR = searchOr;
  }
}
