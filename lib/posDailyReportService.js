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
        select: {
          amount: true,
          paymentMethod: true,
          saleId: true,
          allocations: { select: { paymentAccountId: true, amount: true } },
        },
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

  const paymentAccountIds = [
    ...new Set([
      ...payments.map((p) => p.paymentMethod).filter(Boolean),
      ...payments.flatMap((p) => (p.allocations || []).map((a) => a.paymentAccountId).filter(Boolean)),
    ]),
  ];
  const paRows =
    paymentAccountIds.length > 0
      ? await prisma.paymentAccount.findMany({
          where: { tenantId, id: { in: paymentAccountIds } },
          select: { id: true, name: true, accountType: true },
        })
      : [];
  const paById = new Map(paRows.map((r) => [r.id, r]));

  const salePaymentsBySaleId = new Map();
  for (const p of payments) {
    if (!salePaymentsBySaleId.has(p.saleId)) salePaymentsBySaleId.set(p.saleId, []);
    salePaymentsBySaleId.get(p.saleId).push(p);
  }

  const transactions = sales.map((s) => {
    const pays = salePaymentsBySaleId.get(s.id) || [];
    const lines = [];
    for (const p of pays) {
      if (p.allocations && p.allocations.length > 0) {
        for (const al of p.allocations) {
          const acc = al.paymentAccountId ? paById.get(al.paymentAccountId) : null;
          const label = acc
            ? `${acc.name} (${acc.accountType || 'Account'})`
            : al.paymentAccountId || 'Account';
          lines.push({
            paymentMethodKey: (p.paymentMethod || '').trim(),
            paymentAccountId: al.paymentAccountId || null,
            paymentAccountName: acc?.name || 'Account',
            label,
            amount: Number(al.amount || 0),
          });
        }
      } else {
        const pm = (p.paymentMethod || '').trim();
        const acc = pm && paById.has(pm) ? paById.get(pm) : null;
        const label = acc ? `${acc.name} (${acc.accountType || 'Account'})` : pm || 'Payment';
        lines.push({
          paymentMethodKey: pm,
          paymentAccountId: acc?.id || null,
          paymentAccountName: acc?.name || pm || 'Payment',
          label,
          amount: Number(p.amount || 0),
        });
      }
    }
    return {
      id: s.id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      total: Number(s.total || 0),
      paymentLines: lines,
      primaryPaymentLabel:
        lines.length === 1
          ? `${lines[0].label} — ${lines[0].amount}`
          : lines.map((l) => `${l.label}: ${l.amount}`).join(' · '),
    };
  });

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
    transactions,
    metadata: { generatedAt: new Date().toISOString() }
  };
}

/**
 * Sum cash-tendered amounts for the day (allocations to system Cash account + legacy payments keyed as that id).
 * @param {string} systemCashPaymentAccountId
 */
export async function sumCashSalesForPosDay(
  tenantId,
  date,
  branchId,
  options,
  systemCashPaymentAccountId
) {
  const report = await generatePosDailyReport(tenantId, date, branchId, options);
  const sid = systemCashPaymentAccountId;
  if (!sid) return { totalCashSales: 0, report };
  let totalCashSales = 0;
  for (const tx of report.transactions || []) {
    for (const line of tx.paymentLines || []) {
      if (line.paymentAccountId === sid || line.paymentMethodKey === sid) {
        totalCashSales += Number(line.amount || 0);
      }
    }
  }
  return { totalCashSales, report };
}
