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
 * @param {string|null} branchId — when set, only transactions with this branchId (strict)
 */
export async function getQuantityOnHandAsOfDate(prisma, tenantId, productId, asOfDate, branchId = null) {
  const end = asOfDate instanceof Date ? new Date(asOfDate) : new Date(asOfDate);
  if (Number.isNaN(end.getTime())) return 0;
  end.setHours(23, 59, 59, 999);
  const where = {
    tenantId,
    productId,
    createdAt: { lte: end },
  };
  if (branchId) where.branchId = branchId;

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

async function getOpeningBalanceForProduct(tenantId, productId, start, branchId) {
  const where = {
    tenantId,
    productId,
    createdAt: { lt: start }
  };
  if (branchId) where.branchId = branchId;

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
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const branchFilter = branchId ? { branchId } : {};

  // 1) Get product(s): filter by productId when provided (performance)
  let productIds = [];
  if (productId) {
    const p = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true }
    });
    if (p) productIds = [p.id];
  }

  // 2) Period transactions (index-friendly: productId, createdAt)
  const periodWhere = {
    tenantId,
    createdAt: { gte: start, lte: end },
    ...branchFilter
  };
  if (productIds.length) periodWhere.productId = productIds[0];

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
    const stockEligible = await prisma.product.findMany({
      where: {
        tenantId,
        isDeleted: false,
        isService: false,
        OR: [
          { inventoryAccountId: { not: null } },
          ...(idsFromPeriod.length ? [{ id: { in: idsFromPeriod } }] : []),
          { stockLevel: { gt: 0 } },
        ],
      },
      select: { id: true, name: true },
    });
    const idsFromStock = stockEligible.map((p) => p.id);
    const nameById = new Map(stockEligible.map((p) => [p.id, p.name || '']));
    productIds = [...new Set([...idsFromPeriod, ...idsFromStock])];
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
      openingByProduct[pid] = await getOpeningBalanceForProduct(tenantId, pid, start, branchId);
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
    // Running balance must not go negative for display; keep actual running total for accuracy
    const runningTotal = productMap[t.productId].runningBalance;
    const row = {
      date: t.createdAt,
      transactionType: getDisplayType(t.type),
      qtyIn: qtyInNum,
      qtyOut: qtyOutNum,
      balance: Math.max(0, runningTotal),
      reference: getReference(t.notes) || ''
    };
    productMap[t.productId].movements.push(row);
  }

  // Reconcile to actual stock when period includes today (so closing = product.stockLevel, opening = closing - net).
  // Only when no branch filter, since Product.stockLevel is global. Past periods use transaction-based opening/closing.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const periodEndIsCurrent = end >= todayStart;
  const useActualStockForClosing = periodEndIsCurrent && !branchId;

  for (const pid of productIds) {
    const data = productMap[pid];
    if (!data) {
      const product = await prisma.product.findUnique({
        where: { id: pid, tenantId },
        select: { id: true, name: true, sku: true, cost: true, stockLevel: true }
      });
      if (!product) continue;
      const openBal = openingByProduct[pid] ?? 0;
      const currentStock = Math.max(0, Number(product.stockLevel) || 0);
      const closingBal = Math.max(0, useActualStockForClosing ? currentStock : openBal);
      const openBalDisplay = Math.max(0, useActualStockForClosing ? closingBal : openBal);
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

    const openingFromTx = data.openingBalance ?? 0;
    let opening = openingFromTx;
    let closing = opening + net;

    if (useActualStockForClosing && data.product) {
      const currentStock = Math.max(0, Number(data.product.stockLevel) || 0);
      closing = currentStock;
      opening = closing - net;
      totals.balance = Math.max(0, closing);
      // Recompute each row's running balance so it flows from reconciled opening to closing; display never negative
      let running = opening;
      for (const row of data.movements) {
        running += (Number(row.qtyIn) || 0) - (Number(row.qtyOut) || 0);
        row.balance = Math.max(0, running);
      }
    } else {
      totals.balance = Math.max(0, closing);
    }

    // Never show negative quantities: clamp opening and closing for display
    const openingDisplay = Math.max(0, opening);
    const closingDisplay = Math.max(0, closing);

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
