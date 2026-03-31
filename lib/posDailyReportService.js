/**
 * Daily POS Micro Report – One calendar day only.
 * Data: POS Sales (completed, not voided), SaleItem quantities, Payment breakdown.
 * Read-only, no accounting entries.
 */
import prisma from './prisma';

/**
 * Generate daily POS report for a single date.
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string|null} branchId - single branch, or null for tenant-wide / multi-branch scope
 * @param {{ branchIdsIn?: string[]|null }} [options] - when branchId is null and branchIdsIn is set, scope to those branches plus org-wide (null branch) sales
 * @returns {Promise<{ date, totalSales, transactionCount, itemsSold, averageSaleValue, paymentBreakdown, cashierBreakdown?, totalCogs?, grossProfit?, voidedCount?, refundCount? }>}
 */
export async function generatePosDailyReport(tenantId, date, branchId = null, options = {}) {
  const branchIdsIn = options.branchIdsIn || null;

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const saleWhere = {
    tenantId,
    saleDate: { gte: dayStart, lte: dayEnd },
    status: { equals: 'completed', mode: 'insensitive' },
    voidedAt: null,
    isReversal: false
  };
  if (branchId) {
    saleWhere.branchId = branchId;
  } else if (branchIdsIn && branchIdsIn.length > 0) {
    saleWhere.OR = [{ branchId: null }, { branchId: { in: branchIdsIn } }];
  }

  const [sales, voidedSales, saleItems] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        items: { select: { quantity: true, amount: true, productId: true, customProductData: true } },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { saleDate: 'asc' }
    }),
    prisma.sale.count({
      where: {
        tenantId,
        saleDate: { gte: dayStart, lte: dayEnd },
        voidedAt: { not: null },
        ...(branchId
          ? { branchId }
          : branchIdsIn && branchIdsIn.length > 0
            ? { OR: [{ branchId: null }, { branchId: { in: branchIdsIn } }] }
            : {})
      }
    }),
    prisma.saleItem.findMany({
      where: { sale: saleWhere },
      select: { quantity: true, saleId: true, productId: true, customProductData: true }
    })
  ]);

  const saleIds = sales.map(s => s.id);
  const payments = saleIds.length
    ? await prisma.payment.findMany({
        where: {
          tenantId,
          saleId: { in: saleIds },
          status: { equals: 'Completed', mode: 'insensitive' },
          isReversal: false
        },
        select: { amount: true, paymentMethod: true, saleId: true }
      })
    : [];

  const totalSales = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const transactionCount = sales.length;
  const itemsSold = saleItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const averageSaleValue = transactionCount > 0 ? totalSales / transactionCount : 0;

  const paymentByMethod = {};
  payments.forEach(p => {
    const method = (p.paymentMethod || 'Other').trim() || 'Other';
    const key = method.toLowerCase().replace(/\s+/g, '_');
    if (!paymentByMethod[key]) paymentByMethod[key] = { label: method, total: 0 };
    paymentByMethod[key].total += Number(p.amount || 0);
  });
  const paymentBreakdown = Object.values(paymentByMethod);
  const paymentGrandTotal = paymentBreakdown.reduce((s, x) => s + x.total, 0);

  const cashierMap = new Map();
  sales.forEach(s => {
    const uid = s.createdById;
    const name = s.createdBy?.name || 'Unknown';
    if (!cashierMap.has(uid)) cashierMap.set(uid, { userId: uid, name, sales: 0, transactions: 0 });
    cashierMap.get(uid).sales += Number(s.total || 0);
    cashierMap.get(uid).transactions += 1;
  });
  const cashierBreakdown = Array.from(cashierMap.values());

  let totalCogs = 0;
  let productIds = [...new Set(saleItems.filter(i => i.productId).map(i => i.productId))];
  if (productIds.length > 0) {
    try {
      const { getCOGSTransactionStats } = await import('./cogsIntegration');
      const dayStr = date;
      const cogsStats = await getCOGSTransactionStats(
        tenantId,
        dayStr,
        dayStr,
        branchId,
        !branchId && branchIdsIn && branchIdsIn.length > 0 ? branchIdsIn : null
      );
      totalCogs = Number(cogsStats?.totalCOGS ?? 0) || 0;
    } catch (_) {}
  }
  const grossProfit = totalSales - totalCogs;

  const refundCount = sales.filter(s => s.refundedAt != null).length;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, logoUrl: true }
  });

  return {
    companyName: tenant?.name || 'Company',
    logoUrl: tenant?.logoUrl || null,
    date,
    period: { startDate: date, endDate: date },
    totalSales,
    transactionCount,
    itemsSold,
    averageSaleValue,
    paymentBreakdown,
    paymentGrandTotal,
    cashierBreakdown,
    totalCogs,
    grossProfit,
    voidedCount: voidedSales,
    refundCount,
    productsAffected: productIds.length,
    metadata: { generatedAt: new Date().toISOString() }
  };
}
