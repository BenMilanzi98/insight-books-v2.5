/**
 * Resolve optional ProductUnit for a PO goods line (flexible measurements).
 * Accepts item.productUnitId or item.unitId; auto-picks the only active unit when exactly one exists.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} tx
 * @param {string} tenantId
 * @param {object} item - body line with lineType, productId, productUnitId?, unitId?
 * @returns {Promise<{ productUnitId: string | null, error?: string }>}
 */
export async function resolvePurchaseOrderLineProductUnit(tx, tenantId, item) {
  const lineType = (item.lineType || (item.productId ? 'goods' : 'service')).toLowerCase();
  if (lineType !== 'goods' || !item.productId) {
    return { productUnitId: null };
  }

  const rawPu =
    item.productUnitId != null && String(item.productUnitId).trim()
      ? String(item.productUnitId).trim()
      : null;
  const rawUnit =
    item.unitId != null && String(item.unitId).trim() ? String(item.unitId).trim() : null;

  if (rawPu) {
    const pu = await tx.productUnit.findFirst({
      where: { id: rawPu, productId: item.productId },
      include: { product: { select: { tenantId: true } } },
    });
    if (!pu || pu.product.tenantId !== tenantId) {
      return { productUnitId: null, error: 'Invalid productUnitId for this product or tenant.' };
    }
    return { productUnitId: pu.id };
  }

  if (rawUnit) {
    const pu = await tx.productUnit.findFirst({
      where: { productId: item.productId, unitId: rawUnit, isActive: true },
      include: { product: { select: { tenantId: true } } },
    });
    if (!pu || pu.product.tenantId !== tenantId) {
      return {
        productUnitId: null,
        error:
          'Invalid unitId for this product. Add the unit on Stock / product settings first.',
      };
    }
    return { productUnitId: pu.id };
  }

  const activeUnits = await tx.productUnit.findMany({
    where: { productId: item.productId, isActive: true },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });

  if (activeUnits.length === 0) {
    return { productUnitId: null };
  }
  if (activeUnits.length === 1) {
    return { productUnitId: activeUnits[0].id };
  }
  return {
    productUnitId: null,
    error:
      'This product has multiple units. Specify productUnitId or unitId on the line (flexible measurement).',
  };
}
