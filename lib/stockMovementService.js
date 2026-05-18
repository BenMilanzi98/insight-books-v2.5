// lib/stockMovementService.js
/**
 * Stock Movement Report – Developer Guide (FINAL)
 *
 * Purpose: Show accurate movement of stock per product over a selected period.
 * Data: Products table, Goods Receipt/Purchases (goods_receipt → Qty In),
 *       Sales POS+Invoices (sale → Qty Out), Returns (sales return → Qty In, purchase return → Qty Out).
 *
 * Rules:
 * - Qty In = goods_receipt + sales_return only. Qty Out = sales + purchase_return only.
 * - Opening Balance = Sum(Qty In − Qty Out) before start date.
 * - Balance = running: previous balance + Qty In − Qty Out.
 * - Never show "-" for quantity → use 0. All qtyIn/qtyOut are numeric.
 * - Reference from transaction (GR number, Sale number, etc.).
 */

import prisma from './prisma';
import {
  parseInclusiveApiYmdRange,
  formatYmdInTimeZone,
  DEFAULT_REPORT_TIMEZONE,
} from './dateUtils';

// Qty In: goods_receipt, purchase, sales return / refund restoration. Qty Out: sale, purchase_return.
const QTY_IN_TYPES = ['goods_receipt', 'goods receipt', 'purchase', 'stock in', 'stock_in', 'refund_restoration', 'sale_refund', 'sales_return', 'sales return', 'void_restoration', 'reversal_restoration'];
const QTY_OUT_TYPES = ['sale', 'stock out', 'stock_out', 'purchase_return', 'purchase return'];

function normalizeType(type) {
  return (type || '').toLowerCase().trim().replace(/\s+/g, '_');
}

function isQtyInType(type) {
  const t = normalizeType(type);
  return QTY_IN_TYPES.some(x => x.toLowerCase().replace(/\s+/g, '_') === t);
}

function isQtyOutType(type) {
  const t = normalizeType(type);
  return QTY_OUT_TYPES.some(x => x.toLowerCase().replace(/\s+/g, '_') === t);
}

/**
 * For a transaction, return { qtyIn, qtyOut } (numeric, never null). FIFO-safe.
 * - In types: qtyIn = positive quantity, qtyOut = 0
 * - Out types: qtyIn = 0, qtyOut = abs(quantity)
 * - Adjustment: by sign
 */
/** Return { qtyIn, qtyOut } numeric (never "-"). FIFO-safe. */
function getQtyInAndOut(transaction) {
  const rawQty = Number(transaction.quantity);
  const qty = Number.isFinite(rawQty) ? rawQty : 0;
  const type = (transaction.type || '').toLowerCase().trim();

  if (isQtyInType(type)) {
    return { qtyIn: Math.max(0, qty), qtyOut: 0 };
  }
  if (isQtyOutType(type)) {
    return { qtyIn: 0, qtyOut: Math.abs(qty) };
  }
  // adjustment or unknown: positive = in, negative = out
  if (qty > 0) return { qtyIn: qty, qtyOut: 0 };
  if (qty < 0) return { qtyIn: 0, qtyOut: Math.abs(qty) };
  return { qtyIn: 0, qtyOut: 0 };
}

function getDisplayType(type) {
  const t = (type || '').toLowerCase();
  const map = {
    goods_receipt: 'Goods Receipt',
    purchase: 'Purchase',
    'stock in': 'Stock In',
    stock_in: 'Stock In',
    sale: 'Sale',
    'stock out': 'Stock Out',
    stock_out: 'Stock Out',
    refund_restoration: 'Sales Return',
    sale_refund: 'Sales Return',
    sales_return: 'Sales Return',
    void_restoration: 'Sale void (returned)',
    reversal_restoration: 'Reversal (returned)',
    purchase_return: 'Purchase Return',
    adjustment: 'Adjustment'
  };
  return map[t] || type || 'Other';
}

/** Extract reference from notes: GR number, Sale number, etc. Never return "-". */
function getReference(notes) {
  if (notes == null || String(notes).trim() === '') return '';
  const s = String(notes).trim();
  const m1 = s.match(/(?:Receipt|Sale|Purchase|Bill|Invoice|Refund)\s+([A-Za-z0-9-_]+)/i);
  if (m1) return m1[1];
  const m2 = s.match(/refund.*(?:for\s+)?sale\s+([A-Za-z0-9-_]+)/i);
  if (m2) return m2[1];
  return s;
}

/**
 * Compute opening balance for one product: sum of (Qty In - Qty Out) for all transactions before start date.
 */
/**
 * On-hand quantity for one SKU through end of `asOfDate` (from InventoryTransaction rows).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string} productId
 * @param {Date|string} asOfDate
 * Branch scope is applied at the product level in {@link generateStockMovementReport}, not per-row branchId
 * (most InventoryTransaction rows have null branchId).
 */
export async function getQuantityOnHandAsOfDate(prisma, tenantId, productId, asOfDate, _legacyBranchId = null) {
  void _legacyBranchId;
  const end = asOfDate instanceof Date ? new Date(asOfDate) : new Date(asOfDate);
  if (Number.isNaN(end.getTime())) return 0;
  end.setHours(23, 59, 59, 999);
  const where = {
    tenantId,
    productId,
    createdAt: { lte: end },
  };

  const transactions = await prisma.inventoryTransaction.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: { type: true, quantity: true },
  });

  let bal = 0;
  for (const t of transactions) {
    const { qtyIn, qtyOut } = getQtyInAndOut(t);
    bal += qtyIn - qtyOut;
  }
  return bal;
}

/**
 * Product IDs visible for the current branch (matches /api/stock/transactions branch scoping).
 * @returns {string[]|null} null = all products; [] = none
 */
async function resolveBranchProductIds(tenantId, branchId, productId = null) {
  if (productId) {
    const p = await prisma.product.findFirst({
      where: { id: productId, tenantId, isDeleted: false, isService: false },
      select: { id: true, branchId: true },
    });
    if (!p) return [];
    if (branchId && p.branchId && p.branchId !== branchId) return [];
    return [p.id];
  }
  if (!branchId) return null;
  const rows = await prisma.product.findMany({
    where: { tenantId, branchId, isDeleted: false, isService: false },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function getOpeningBalanceForProduct(tenantId, productId, start) {
  const where = {
    tenantId,
    productId,
    createdAt: { lt: start },
  };

  const transactions = await prisma.inventoryTransaction.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: { type: true, quantity: true }
  });

  let opening = 0;
  for (const t of transactions) {
    const { qtyIn, qtyOut } = getQtyInAndOut(t);
    opening += qtyIn - qtyOut;
  }
  return opening;
}

/**
 * Generate stock movement report for a period.
 * @param {string} tenantId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string|null} productId - optional filter (performance: load movements only for selected product)
 * @param {string|null} branchId
 * @returns Report payload: { period, productMovements[], companyName, logoUrl }
 */
export async function generateStockMovementReport(tenantId, startDate, endDate, productId = null, branchId = null) {
  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

  const branchScopeIds = await resolveBranchProductIds(tenantId, branchId, productId);
  if (branchScopeIds && branchScopeIds.length === 0) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });
    return {
      companyName: tenant?.name || 'Company',
      logoUrl: tenant?.logoUrl || null,
      period: { startDate, endDate },
      productMovements: [],
    };
  }

  // 1) Get product(s): filter by productId when provided (performance)
  let productIds = [];
  if (productId && branchScopeIds) {
    productIds = branchScopeIds;
  } else if (productId) {
    const p = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true },
    });
    if (p) productIds = [p.id];
  }

  // 2) Period transactions (index-friendly: productId, createdAt)
  const periodWhere = {
    tenantId,
    createdAt: { gte: start, lte: end },
  };
  if (branchScopeIds?.length) {
    periodWhere.productId = { in: branchScopeIds };
  } else if (productIds.length) {
    periodWhere.productId = productIds[0];
  }

  const periodTransactions = await prisma.inventoryTransaction.findMany({
    where: periodWhere,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true,
          stockLevel: true
        }
      }
    },
    orderBy: [{ productId: 'asc' }, { createdAt: 'asc' }]
  });

  const idsFromPeriod = [...new Set(periodTransactions.map((t) => t.productId))];

  if (!productIds.length) {
    /** Full export: include every physical (non-service, active) SKU, not only rows with movement in-period. */
    const stockWhere = {
      tenantId,
      isDeleted: false,
      isService: false,
      OR: [
        { inventoryAccountId: { not: null } },
        ...(idsFromPeriod.length ? [{ id: { in: idsFromPeriod } }] : []),
        { stockLevel: { gt: 0 } },
      ],
    };
    if (branchId) stockWhere.branchId = branchId;
    const stockEligible = await prisma.product.findMany({
      where: stockWhere,
      select: { id: true, name: true },
    });
    const idsFromStock = stockEligible.map((p) => p.id);
    const nameById = new Map(stockEligible.map((p) => [p.id, p.name || '']));
    productIds = [...new Set([...idsFromPeriod, ...idsFromStock])];
    if (branchScopeIds?.length) {
      const scopeSet = new Set(branchScopeIds);
      productIds = productIds.filter((id) => scopeSet.has(id));
    }
    productIds.sort((a, b) => (nameById.get(a) || '').localeCompare(nameById.get(b) || '', undefined, { sensitivity: 'base' }));

    if (productIds.length === 0) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, logoUrl: true },
      });
      return {
        companyName: tenant?.name || 'Company',
        logoUrl: tenant?.logoUrl || null,
        period: { startDate, endDate },
        productMovements: [],
      };
    }
  }

  // 3) For each product: opening balance (all transactions before start)
  const openingByProduct = {};
  await Promise.all(
    productIds.map(async (pid) => {
      openingByProduct[pid] = await getOpeningBalanceForProduct(tenantId, pid, start);
    })
  );

  // 4) Build movements per product with running balance; totals row
  const productMovements = [];
  const productMap = {};
  for (const t of periodTransactions) {
    if (!productMap[t.productId]) {
      productMap[t.productId] = {
        product: t.product,
        openingBalance: openingByProduct[t.productId] ?? 0,
        movements: [],
        runningBalance: openingByProduct[t.productId] ?? 0
      };
    }
    const { qtyIn, qtyOut } = getQtyInAndOut(t);
    const qtyInNum = Number(qtyIn) || 0;
    const qtyOutNum = Number(qtyOut) || 0;
    productMap[t.productId].runningBalance += qtyInNum - qtyOutNum;
    const runningTotal = productMap[t.productId].runningBalance;
    const row = {
      date: t.createdAt,
      transactionType: getDisplayType(t.type),
      qtyIn: qtyInNum,
      qtyOut: qtyOutNum,
      balance: runningTotal,
      reference: getReference(t.notes) || '',
    };
    productMap[t.productId].movements.push(row);
  }

  // Current period (end date is today or later in report TZ): reconcile to live stock when tenant-wide.
  // Past periods and branch-scoped reports use full InventoryTransaction history through period end.
  const todayYmd = formatYmdInTimeZone(new Date(), DEFAULT_REPORT_TIMEZONE);
  const endYmd = String(endDate).trim().slice(0, 10);
  const periodEndIsCurrent = endYmd >= todayYmd;
  const useLiveStockForClosing = periodEndIsCurrent && !branchId;

  for (const pid of productIds) {
    const data = productMap[pid];
    if (!data) {
      const product = await prisma.product.findUnique({
        where: { id: pid, tenantId },
        select: { id: true, name: true, sku: true, cost: true, stockLevel: true }
      });
      if (!product) continue;
      const openBal = openingByProduct[pid] ?? 0;
      let closingBal;
      if (useLiveStockForClosing) {
        closingBal = Number(product.stockLevel) || 0;
      } else {
        closingBal = await getQuantityOnHandAsOfDate(prisma, tenantId, pid, end);
      }
      const openBalDisplay = openBal;
      const movements = [
        {
          date: null,
          transactionType: 'Closing balance',
          qtyIn: 0,
          qtyOut: 0,
          balance: closingBal,
          reference: ''
        }
      ];
      productMovements.push({
        product: { id: product.id, name: product.name, sku: product.sku, cost: product.cost, stockLevel: product.stockLevel },
        openingBalance: openBalDisplay,
        movements,
        totals: { qtyIn: 0, qtyOut: 0, net: 0, netDisplay: 0, netDirection: 'in', balance: closingBal },
        closingBalance: closingBal
      });
      continue;
    }
    const totals = data.movements.reduce(
      (acc, m) => {
        acc.qtyIn += m.qtyIn;
        acc.qtyOut += m.qtyOut;
        return acc;
      },
      { qtyIn: 0, qtyOut: 0 }
    );
    const net = totals.qtyIn - totals.qtyOut;
    totals.net = net;
    totals.netDisplay = Math.abs(net);
    totals.netDirection = net >= 0 ? 'in' : 'out';

    let opening = openingByProduct[pid] ?? data.openingBalance ?? 0;
    let closing;

    if (useLiveStockForClosing && data.product) {
      closing = Number(data.product.stockLevel) || 0;
      opening = closing - net;
    } else {
      closing = await getQuantityOnHandAsOfDate(prisma, tenantId, pid, end);
    }

    totals.balance = closing;

    // Running balance from opening through each movement (matches historical on-hand)
    let running = opening;
    for (const row of data.movements) {
      running += (Number(row.qtyIn) || 0) - (Number(row.qtyOut) || 0);
      row.balance = running;
    }

    const openingDisplay = opening;
    const closingDisplay = closing;

    // Append explicit closing balance line at the end of movements for reporting
    data.movements.push({
      date: null,
      transactionType: 'Closing balance',
      qtyIn: 0,
      qtyOut: 0,
      balance: closingDisplay,
      reference: ''
    });

    productMovements.push({
      product: data.product,
      openingBalance: openingDisplay,
      movements: data.movements,
      totals,
      closingBalance: closingDisplay
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, logoUrl: true }
  });

  return {
    companyName: tenant?.name || 'Company',
    logoUrl: tenant?.logoUrl || null,
    period: { startDate, endDate },
    productMovements
  };
}
