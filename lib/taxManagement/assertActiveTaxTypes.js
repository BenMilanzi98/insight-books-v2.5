/**
 * Ensure every taxTypeId belongs to tenant and is Active.
 * Optionally allow specific IDs to remain Inactive (e.g. historical document lines on update).
 * @param {import('@prisma/client').PrismaClient} db
 * @param {string} tenantId
 * @param {string[]} taxTypeIds
 * @param {Iterable<string>|Set<string>} [allowInactiveIds] IDs that may stay Inactive (must still exist for tenant)
 */
export async function assertActiveTaxTypeIds(db, tenantId, taxTypeIds, allowInactiveIds) {
  const ids = [...new Set((taxTypeIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length === 0) return;

  const allowInactive = new Set(
    [...(allowInactiveIds instanceof Set ? allowInactiveIds : (allowInactiveIds || []))]
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );

  const rows = await db.taxType.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, status: true, taxName: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      const err = new Error(`Unknown tax type: ${id}`);
      err.code = 'UNKNOWN_TAX';
      err.status = 400;
      throw err;
    }
    if (row.status !== 'Active' && !allowInactive.has(id)) {
      const err = new Error(
        `Tax "${row.taxName || id}" is not active and cannot be used on new documents.`
      );
      err.code = 'INACTIVE_TAX';
      err.status = 400;
      throw err;
    }
  }
}

/** Collect taxTypeIds from quotation/invoice item tax arrays. */
export function collectTaxTypeIdsFromItems(items) {
  const ids = [];
  for (const item of items || []) {
    const taxes = item.itemTaxes || item.taxes || item.taxBreakdown || [];
    for (const t of taxes) {
      const id = t.taxTypeId || t.id;
      if (id) ids.push(id);
    }
  }
  return ids;
}
