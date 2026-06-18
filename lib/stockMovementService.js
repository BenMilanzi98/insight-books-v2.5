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
} from './dateUtils';
import { getGlPeriodTotals } from './reportingEngine/index.js';
import { buildReconciliationItem, buildReconciliationSummary } from './reportingEngine/reportReconciliation.js';

// Qty In: goods_receipt, purchase, sales return / refund restoration. Qty Out: sale, purchase_return.
const QTY_IN_TYPES = ['goods_receipt', 'goods receipt', 'purchase', 'stock in', 'stock_in', 'refund_restoration', 'sale_refund', 'sales_return', 'sales return', 'void_restoration', 'reversal_restoration'];
const QTY_OUT_TYPES = ['sale', 'invoice', 'stock out', 'stock_out', 'purchase_return', 'purchase return'];

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
    invoice: 'Invoice',
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
/** Alphabetical order for report UI and export (name, then SKU). */
function compareProductMovementsByName(a, b) {
  const nameA = (a.product?.name || '').trim();
  const nameB = (b.product?.name || '').trim();
  const byName = nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
  if (byName !== 0) return byName;
  return (a.product?.sku || '').trim().localeCompare((b.product?.sku || '').trim(), undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

function getReference(notes) {
  if (notes == null || String(notes).trim() === '') return '';
  const s = String(notes).trim();
  const m1 = s.match(/(?:Receipt|Sale|Purchase|Bill|Invoice|Refund)\s+([A-Za-z0-9-_]+)/i);
  if (m1) return m1[1];
  const m2 = s.match(/refund.*(?:for\s+)?sale\s+([A-Za-z0-9-_]+)/i);
  if (m2) return m2[1];
  return s;
}

function toStockNumber(value) {
  if (value == null || value === undefined) return 0;
  if (typeof value === 'object' && typeof value.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nonNegativeQuantity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function addTransactionDelta(balance, transaction) {
  const { qtyIn, qtyOut } = getQtyInAndOut(transaction);
  return balance + (Number(qtyIn) || 0) - (Number(qtyOut) || 0);
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
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId, isDeleted: false, isService: false },
    select: { stockLevel: true },
  });
  const allTimeDelta = await getInventoryTransactionDelta(tenantId, productId, null, prisma);
  const baseline = toStockNumber(product?.stockLevel) - allTimeDelta;
  const asOfDelta = await getInventoryTransactionDelta(
    tenantId,
    productId,
    { lte: end },
    prisma
  );
  return nonNegativeQuantity(baseline + asOfDelta);
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
    where: {
      tenantId,
      isDeleted: false,
      isService: false,
      OR: [{ branchId }, { branchId: null }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function getInventoryTransactionDelta(tenantId, productId, createdAt = null, client = prisma) {
  const where = {
    tenantId,
    productId,
  };
  if (createdAt) where.createdAt = createdAt;

  const transactions = await client.inventoryTransaction.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: { type: true, quantity: true }
  });

  let balance = 0;
  for (const t of transactions) {
    balance = addTransactionDelta(balance, t);
  }
  return balance;
}

async function getOpeningBalanceForProduct(tenantId, productId, start, baselineQty = 0) {
  const prePeriodDelta = await getInventoryTransactionDelta(tenantId, productId, {
    lt: start,
  });
  return nonNegativeQuantity(baselineQty + prePeriodDelta);
}

const PRODUCT_ID_CHUNK_SIZE = 250;

/** Sum ledger deltas per productId for many SKUs (batched to avoid huge IN lists). */
async function getLedgerDeltaByProductId(tenantId, productIds, createdAtFilter, client = prisma) {
  const map = new Map();
  if (!productIds.length) return map;

  for (let i = 0; i < productIds.length; i += PRODUCT_ID_CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + PRODUCT_ID_CHUNK_SIZE);
    const where = {
      tenantId,
      productId: { in: chunk },
    };
    if (createdAtFilter) where.createdAt = createdAtFilter;

    const transactions = await client.inventoryTransaction.findMany({
      where,
      select: { productId: true, type: true, quantity: true },
    });

    for (const t of transactions) {
      const pid = t.productId;
      const delta = addTransactionDelta(0, t);
      map.set(pid, (map.get(pid) || 0) + delta);
    }
  }
  return map;
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
  const productById = new Map();
  if (productId && branchScopeIds) {
    productIds = branchScopeIds;
  } else if (productId) {
    const p = await prisma.product.findFirst({
      where: { id: productId, tenantId, isDeleted: false, isService: false },
      select: { id: true, name: true, sku: true, cost: true, stockLevel: true },
    });
    if (p) {
      productIds = [p.id];
      productById.set(p.id, p);
    }
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
    /** Full export: include every physical (non-service, active) SKU, including zero-balance SKUs. */
    const stockWhere = {
      tenantId,
      isDeleted: false,
      isService: false,
    };
    if (branchId) stockWhere.OR = [{ branchId }, { branchId: null }];
    const stockEligible = await prisma.product.findMany({
      where: stockWhere,
      select: { id: true, name: true, sku: true, cost: true, stockLevel: true },
    });
    const idsFromStock = stockEligible.map((p) => p.id);
    const nameById = new Map(stockEligible.map((p) => [p.id, p.name || '']));
    for (const product of stockEligible) productById.set(product.id, product);
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

  if (productIds.length > 0) {
    const missingProductIds = productIds.filter((pid) => !productById.has(pid));
    if (missingProductIds.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: missingProductIds }, tenantId, isDeleted: false, isService: false },
        select: { id: true, name: true, sku: true, cost: true, stockLevel: true },
      });
      for (const product of products) productById.set(product.id, product);
    }
    productIds = productIds.filter((pid) => productById.has(pid));
  }

  // 3) Stock levels and ledger deltas in bulk (avoid per-product DB storms).
  const stockRows =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, tenantId, isDeleted: false, isService: false },
          select: { id: true, stockLevel: true },
        })
      : [];
  const stockByProductId = new Map(
    stockRows.map((p) => [p.id, toStockNumber(p.stockLevel)])
  );

  const [ledgerAllTime, ledgerThroughEnd, prePeriodDeltaByProduct] = await Promise.all([
    getLedgerDeltaByProductId(tenantId, productIds, null, prisma),
    getLedgerDeltaByProductId(tenantId, productIds, { lte: end }, prisma),
    getLedgerDeltaByProductId(tenantId, productIds, { lt: start }, prisma),
  ]);

  const baselineByProduct = {};
  const openingByProduct = {};
  for (const pid of productIds) {
    const stockLevel = stockByProductId.get(pid) ?? 0;
    const allTime = ledgerAllTime.get(pid) ?? 0;
    const prePeriod = prePeriodDeltaByProduct.get(pid) ?? 0;
    baselineByProduct[pid] = stockLevel - allTime;
    openingByProduct[pid] = nonNegativeQuantity(baselineByProduct[pid] + prePeriod);
  }

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
    const runningTotal = nonNegativeQuantity(productMap[t.productId].runningBalance);
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

  for (const pid of productIds) {
    const data = productMap[pid];
    if (!data) {
      const product = productById.get(pid);
      if (!product) continue;
      const openBal = openingByProduct[pid] ?? 0;
      const closingBal = nonNegativeQuantity(
        (baselineByProduct[pid] ?? 0) + (ledgerThroughEnd.get(pid) ?? 0)
      );
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

    let opening = nonNegativeQuantity(openingByProduct[pid] ?? data.openingBalance ?? 0);
    const closing = nonNegativeQuantity(
      (baselineByProduct[pid] ?? 0) + (ledgerThroughEnd.get(pid) ?? 0)
    );

    totals.balance = closing;

    // Running balance from opening through each movement (matches historical on-hand)
    let running = opening;
    for (const row of data.movements) {
      running += (Number(row.qtyIn) || 0) - (Number(row.qtyOut) || 0);
      row.balance = nonNegativeQuantity(running);
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

  productMovements.sort(compareProductMovementsByName);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, logoUrl: true }
  });

  let glTotals = null;
  try {
    glTotals = await getGlPeriodTotals({
      tenantId,
      startDate,
      endDate,
      branchId,
      prisma,
    });
  } catch (glErr) {
    console.warn('Stock movement report: GL reconciliation skipped', glErr?.message || glErr);
  }

  const totalClosingQty = productMovements.reduce(
    (s, p) => s + (Number(p.closingBalance) || 0),
    0
  );

  return {
    companyName: tenant?.name || 'Company',
    logoUrl: tenant?.logoUrl || null,
    period: { startDate, endDate },
    productMovements,
    metadata: {
      ledgerSource: 'general_ledger',
      fromGeneralLedger: Boolean(glTotals?.hasGlActivity),
      glInventoryAssetMovement: glTotals?.inventoryAssetMovement ?? 0,
      totalProducts: productMovements.length,
      totalClosingQuantity: totalClosingQty,
      reconciliation: glTotals
        ? buildReconciliationSummary([
            buildReconciliationItem({
              label: 'Inventory asset GL movement',
              glAmount: glTotals.inventoryAssetMovement,
              operationalAmount: 0,
              unit: 'gl_vs_operational',
            }),
          ])
        : null,
      note:
        'Stock quantities come from inventory transactions. GL inventory asset movement is shown for reconciliation with the balance sheet.',
    },
  };
}
