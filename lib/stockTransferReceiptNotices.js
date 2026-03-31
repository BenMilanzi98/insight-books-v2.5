import prisma from '@/lib/prisma';

/**
 * Create or update the dashboard row for a completed cross-tenant transfer (idempotent).
 */
export async function upsertReceiptNoticeForTransfer({
  tenantId,
  stockTransferId,
  sourceTenantId,
  sourceTenantName,
}) {
  return prisma.stockTransferReceiptNotice.upsert({
    where: { stockTransferId },
    create: {
      tenantId,
      stockTransferId,
      sourceTenantId,
      sourceTenantName: sourceTenantName ?? null,
    },
    update: {
      sourceTenantName: sourceTenantName ?? undefined,
    },
  });
}

/**
 * Create StockTransferReceiptNotice rows for cross-tenant transfers that completed
 * but never got a notice (failed insert, old deploy, etc.).
 */
export async function ensureMissingReceiptNoticesForTenant(tenantId) {
  const since = new Date();
  since.setDate(since.getDate() - 120);

  const candidates = await prisma.stockTransfer.findMany({
    where: {
      status: 'received',
      tenantId: { not: tenantId },
      toBranch: { tenantId, isActive: true },
      updatedAt: { gte: since },
    },
    select: { id: true, tenantId: true },
    take: 150,
  });

  if (candidates.length === 0) return;

  let existing = [];
  try {
    existing = await prisma.stockTransferReceiptNotice.findMany({
      where: { stockTransferId: { in: candidates.map((c) => c.id) } },
      select: { stockTransferId: true },
    });
  } catch {
    return;
  }

  const have = new Set(existing.map((e) => e.stockTransferId));

  for (const c of candidates) {
    if (have.has(c.id)) continue;
    const srcTenant = await prisma.tenant.findUnique({
      where: { id: c.tenantId },
      select: { name: true },
    });
    try {
      await prisma.stockTransferReceiptNotice.create({
        data: {
          tenantId,
          stockTransferId: c.id,
          sourceTenantId: c.tenantId,
          sourceTenantName: srcTenant?.name ?? null,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') continue;
      console.warn('[ensureMissingReceiptNoticesForTenant]', err.message);
    }
  }
}

/**
 * When the notice table is missing or broken, build the same shape from StockTransfer alone.
 */
export async function buildReceiptNoticeListFromTransfers(tenantId) {
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: 'received',
      tenantId: { not: tenantId },
      toBranch: { tenantId, isActive: true },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          cost: true,
        },
      },
      fromBranch: {
        select: {
          id: true,
          name: true,
          tenant: { select: { id: true, name: true } },
        },
      },
      toBranch: {
        select: {
          id: true,
          name: true,
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });

  return transfers.map((st) => ({
    id: st.id,
    tenantId,
    stockTransferId: st.id,
    sourceTenantId: st.tenantId,
    sourceTenantName: st.fromBranch?.tenant?.name ?? null,
    readAt: null,
    createdAt: st.updatedAt,
    stockTransfer: st,
    receiptProduct: null,
    _fromTransferFallback: true,
  }));
}
