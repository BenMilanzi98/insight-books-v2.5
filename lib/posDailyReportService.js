/**
 * Daily POS Micro Report – One calendar day only.
 * Data: POS Sales (completed, not voided), SaleItem quantities, Payment breakdown.
 * Read-only, no accounting entries.
 */
import prisma from './prisma';
import { parseInclusiveApiYmdRange } from './dateUtils';
import { saleNetRevenueTotalExTax } from './reportLineNetRevenue';
import { addMoney, roundMoney } from './money';
import {
  buildReconciliationItem,
  buildReconciliationSummary,
  getGlPeriodTotals,
} from './reportingEngine/index.js';
import { classifyCashFlowFromGl } from './cashFlowGlService.js';

function resolveSaleItemDescription(item) {
  if (item?.product?.name) {
    const sku = item.product.sku ? ` (${item.product.sku})` : '';
    return `${item.product.name}${sku}`;
  }
  const raw = item?.customProductData;
  if (raw) {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (typeof raw === 'object' && raw !== null) {
      if (raw.name && String(raw.name).trim()) return String(raw.name).trim();
      if (raw.description && String(raw.description).trim()) return String(raw.description).trim();
    }
  }
  if (item?.description && String(item.description).trim()) return String(item.description).trim();
  return 'Item';
}

/**
 * Generate daily POS report for a single date.
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string|null} branchId - single branch, or null for tenant-wide / multi-branch scope
 * @param {{ branchIdsIn?: string[]|null }} [options] - when branchId is null and branchIdsIn is set, scope to those branches plus org-wide (null branch) sales
 * @returns {Promise<{ date, totalSales, transactionCount, itemsSold, averageSaleValue, paymentBreakdown, cashierBreakdown?, totalCogs?, grossProfit?, voidedCount?, refundCount?, currencyCode?: string, transactions?: Array<{ lineItems: { description: string, quantity: number, unitPrice: number, amount: number }[] }> }>}
 */
export async function generatePosDailyReport(tenantId, date, branchId = null, options = {}) {
  const branchIdsIn = options.branchIdsIn || null;

  const { start: dayStart, end: dayEnd } = parseInclusiveApiYmdRange(date, date);

  const saleWhere = {
    tenantId,
    saleDate: { gte: dayStart, lte: dayEnd },
    status: { equals: 'completed', mode: 'insensitive' },
    voidedAt: null,
    refundedAt: null,
    isReversal: false
  };
  if (branchId) {
    saleWhere.branchId = branchId;
  } else if (branchIdsIn && branchIdsIn.length > 0) {
    saleWhere.OR = [{ branchId: null }, { branchId: { in: branchIdsIn } }];
  }

  const [sales, voidedSales, refundedSales, saleItems] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        items: {
          select: {
            quantity: true,
            amount: true,
            unitPrice: true,
            productId: true,
            description: true,
            isCustom: true,
            customProductData: true,
            product: { select: { name: true, sku: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
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
    prisma.sale.count({
      where: {
        tenantId,
        saleDate: { gte: dayStart, lte: dayEnd },
        status: { equals: 'completed', mode: 'insensitive' },
        voidedAt: null,
        refundedAt: { not: null },
        isReversal: false,
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
      totalCogs = Number(cogsStats?.totalAmount ?? 0) || 0;
    } catch (_) {}
  }
  const grossProfit = totalSales - totalCogs;

  const refundCount = refundedSales;

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
    const lineItems = (s.items || []).map((it) => ({
      description: resolveSaleItemDescription(it),
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      amount: Number(it.amount || 0),
    }));

    return {
      id: s.id,
      saleNumber: s.saleNumber,
      saleDate: s.saleDate,
      total: Number(s.total || 0),
      lineItems,
      paymentLines: lines,
      primaryPaymentLabel:
        lines.length === 1
          ? `${lines[0].label} — ${lines[0].amount}`
          : lines.map((l) => `${l.label}: ${l.amount}`).join(' · '),
    };
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logoUrl: true,
      settings: { select: { currencyCode: true } },
    },
  });

  const netSalesExTax = roundMoney(
    sales.reduce((sum, s) => addMoney(sum, saleNetRevenueTotalExTax(s)), 0)
  );

  let metadata = { generatedAt: new Date().toISOString() };
  try {
    const [glTotals, glCash] = await Promise.all([
      getGlPeriodTotals({
        tenantId,
        startDate: date,
        endDate: date,
        branchId,
        prisma,
      }),
      classifyCashFlowFromGl(tenantId, dayStart, dayEnd, branchId),
    ]);

    metadata = {
      ...metadata,
      ledgerSource: 'general_ledger',
      fromGeneralLedger: Boolean(glTotals?.hasGlActivity || glCash.transactionCount > 0),
      glRevenueTotal: glTotals?.revenue ?? 0,
      glCashNetMovement: glCash.glNetMovement ?? 0,
      reconciliation: buildReconciliationSummary([
        buildReconciliationItem({
          label: 'POS net revenue (ex tax)',
          glAmount: glTotals?.revenue ?? 0,
          operationalAmount: netSalesExTax,
        }),
        buildReconciliationItem({
          label: 'Cash collected',
          glAmount: glCash.glNetMovement ?? 0,
          operationalAmount: roundMoney(paymentGrandTotal),
        }),
      ]),
    };
  } catch (reconErr) {
    console.warn('POS daily report: GL reconciliation skipped', reconErr?.message || reconErr);
  }

  return {
    companyName: tenant?.name || 'Company',
    logoUrl: tenant?.logoUrl || null,
    currencyCode: tenant?.settings?.currencyCode || 'MWK',
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
    netSalesExTax,
    metadata,
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
