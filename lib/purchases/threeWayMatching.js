/**
 * Three-way matching: Purchase Order ↔ Goods Receipt ↔ Supplier Bill (line-level).
 * Pure comparison — does not mutate Order/Receipt to fit the Bill.
 */

export const MATCH_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_STARTED: 'NOT_STARTED',
  EXACT_MATCH: 'EXACT_MATCH',
  WITHIN_TOLERANCE: 'WITHIN_TOLERANCE',
  MATCHED_WITH_VARIANCE: 'MATCHED_WITH_VARIANCE',
  QUANTITY_VARIANCE: 'QUANTITY_VARIANCE',
  PRICE_VARIANCE: 'PRICE_VARIANCE',
  TAX_VARIANCE: 'TAX_VARIANCE',
  TOTAL_VARIANCE: 'TOTAL_VARIANCE',
  RECEIPT_MISSING: 'RECEIPT_MISSING',
  ORDER_MISSING: 'ORDER_MISSING',
  DUPLICATE_BILL: 'DUPLICATE_BILL',
  OVER_BILLED: 'OVER_BILLED',
  UNDER_BILLED: 'UNDER_BILLED',
  WRONG_SUPPLIER: 'WRONG_SUPPLIER',
  WRONG_PRODUCT: 'WRONG_PRODUCT',
  WRONG_CURRENCY: 'WRONG_CURRENCY',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  BLOCKED: 'BLOCKED',
});

export const DEFAULT_TOLERANCES = Object.freeze({
  quantityPercent: 0,
  quantityAbsolute: 0,
  pricePercent: 0.5,
  priceAbsolute: 0.01,
  totalPercent: 0.5,
  totalAbsolute: 1,
  taxAbsolute: 0.01,
});

const BLOCKING = new Set([
  MATCH_STATUS.WRONG_SUPPLIER,
  MATCH_STATUS.WRONG_CURRENCY,
  MATCH_STATUS.WRONG_PRODUCT,
  MATCH_STATUS.OVER_BILLED,
  MATCH_STATUS.RECEIPT_MISSING,
  MATCH_STATUS.DUPLICATE_BILL,
  MATCH_STATUS.BLOCKED,
]);

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function withinAbsOrPct(actual, expected, absTol, pctTol) {
  const diff = Math.abs(actual - expected);
  if (diff <= absTol) return true;
  if (expected === 0) return diff <= absTol;
  return (diff / Math.abs(expected)) * 100 <= pctTol;
}

function aggregateByProduct(rows, qtyField, costField) {
  const map = new Map();
  for (const row of rows) {
    if (!row.productId) continue;
    const prev = map.get(row.productId) || { qty: 0, unitCost: null };
    prev.qty += num(row[qtyField] ?? row.quantity);
    if (prev.unitCost == null) prev.unitCost = num(row[costField] ?? row.unitCost);
    map.set(row.productId, prev);
  }
  return map;
}

/**
 * Evaluate three-way match for an inventory supplier bill.
 */
export function evaluateThreeWayMatch({
  bill,
  billItems = [],
  purchaseOrder = null,
  poItems = [],
  goodsReceipt = null,
  receiptItems = [],
  tolerances = DEFAULT_TOLERANCES,
  requireReceiptForInventory = true,
}) {
  const tol = { ...DEFAULT_TOLERANCES, ...tolerances };
  const lineResults = [];
  const issues = [];
  const billType = String(bill?.billType || 'inventory').toLowerCase();

  if (billType === 'expense' || billType === 'service') {
    return {
      matchingStatus: MATCH_STATUS.NOT_REQUIRED,
      blocked: false,
      issues: [],
      lineResults: [],
      summary: { billedQty: 0, receivedQty: 0, orderedQty: 0 },
    };
  }

  if (bill.supplierId && purchaseOrder?.supplierId && bill.supplierId !== purchaseOrder.supplierId) {
    issues.push({ code: MATCH_STATUS.WRONG_SUPPLIER, message: 'Bill supplier differs from Purchase Order supplier' });
  }
  if (bill.supplierId && goodsReceipt?.supplierId && bill.supplierId !== goodsReceipt.supplierId) {
    issues.push({ code: MATCH_STATUS.WRONG_SUPPLIER, message: 'Bill supplier differs from Goods Receipt supplier' });
  }
  if (bill.currency && purchaseOrder?.currency && String(bill.currency) !== String(purchaseOrder.currency)) {
    issues.push({ code: MATCH_STATUS.WRONG_CURRENCY, message: 'Bill currency differs from Purchase Order' });
  }

  const hasReceipt = Boolean(goodsReceipt || bill.goodsReceiptId);
  if (requireReceiptForInventory && !hasReceipt) {
    issues.push({
      code: MATCH_STATUS.RECEIPT_MISSING,
      message: 'Inventory bill requires a Goods Receipt for three-way matching',
    });
  }

  const receiptByProduct = aggregateByProduct(
    receiptItems,
    'quantityReceived',
    'unitCost'
  );
  // Prefer acceptedQuantity when present
  for (const ri of receiptItems) {
    if (ri.productId && ri.acceptedQuantity != null) {
      const prev = receiptByProduct.get(ri.productId);
      if (prev) prev.qty = num(ri.acceptedQuantity);
    }
  }

  const poByProduct = aggregateByProduct(poItems, 'quantityOrdered', 'unitCost');

  let billedQty = 0;
  let receivedQty = 0;
  let orderedQty = 0;

  for (const item of billItems) {
    const productId = item.productId || null;
    const qty = num(item.quantity ?? item.billedQuantity);
    const unitPrice = num(item.unitCost ?? item.unitPrice);
    billedQty += qty;

    const receipt = productId ? receiptByProduct.get(productId) : null;
    const po = productId ? poByProduct.get(productId) : null;
    const recv = receipt ? receipt.qty : 0;
    const ord = po ? po.qty : 0;
    if (receipt) receivedQty += qty > 0 ? recv : 0;
    if (po) orderedQty += ord;

    const lineIssues = [];
    if (productId && receiptItems.length > 0 && !receipt) {
      lineIssues.push(MATCH_STATUS.WRONG_PRODUCT);
    }
    if (receipt && !withinAbsOrPct(qty, recv, tol.quantityAbsolute, tol.quantityPercent)) {
      if (qty > recv + tol.quantityAbsolute) lineIssues.push(MATCH_STATUS.OVER_BILLED);
      else lineIssues.push(MATCH_STATUS.QUANTITY_VARIANCE);
    }
    const refCost = receipt?.unitCost ?? po?.unitCost;
    if (refCost != null && !withinAbsOrPct(unitPrice, refCost, tol.priceAbsolute, tol.pricePercent)) {
      lineIssues.push(MATCH_STATUS.PRICE_VARIANCE);
    }

    let lineStatus = MATCH_STATUS.EXACT_MATCH;
    if (lineIssues.includes(MATCH_STATUS.OVER_BILLED)) lineStatus = MATCH_STATUS.OVER_BILLED;
    else if (lineIssues.includes(MATCH_STATUS.WRONG_PRODUCT)) lineStatus = MATCH_STATUS.WRONG_PRODUCT;
    else if (lineIssues.length) lineStatus = lineIssues[0];
    else if (
      receipt &&
      (qty !== recv || (refCost != null && unitPrice !== refCost))
    ) {
      lineStatus = MATCH_STATUS.WITHIN_TOLERANCE;
    }

    lineResults.push({
      billLineNumber: item.lineNumber,
      productId,
      billedQuantity: qty,
      receivedQuantity: recv,
      orderedQuantity: ord,
      billedUnitPrice: unitPrice,
      receivedUnitCost: receipt?.unitCost ?? null,
      orderedUnitCost: po?.unitCost ?? null,
      status: lineStatus,
      issues: lineIssues,
    });

    for (const code of lineIssues) {
      issues.push({ code, message: `Line ${item.lineNumber}: ${code}`, lineNumber: item.lineNumber });
    }
  }

  const billNet = num(bill.subtotal != null ? bill.subtotal : bill.totalAmount) - num(bill.taxAmount);
  const receiptValue = receiptItems.reduce(
    (s, ri) => s + num(ri.quantityReceived ?? ri.acceptedQuantity ?? ri.quantity) * num(ri.unitCost),
    0
  );
  if (hasReceipt && receiptItems.length > 0) {
    if (!withinAbsOrPct(billNet, receiptValue, tol.totalAbsolute, tol.totalPercent)) {
      issues.push({
        code: MATCH_STATUS.TOTAL_VARIANCE,
        message: 'Bill net total differs from receipt value beyond tolerance',
      });
    }
  }

  const blocked = issues.some((i) => BLOCKING.has(i.code));

  let matchingStatus;
  if (issues.length === 0) {
    matchingStatus = lineResults.length === 0
      ? MATCH_STATUS.NOT_STARTED
      : lineResults.every((l) => l.status === MATCH_STATUS.EXACT_MATCH)
        ? MATCH_STATUS.EXACT_MATCH
        : MATCH_STATUS.WITHIN_TOLERANCE;
  } else if (blocked) {
    matchingStatus = issues.find((i) => BLOCKING.has(i.code))?.code || MATCH_STATUS.BLOCKED;
  } else if (
    lineResults.length &&
    lineResults.every((l) =>
      [MATCH_STATUS.EXACT_MATCH, MATCH_STATUS.WITHIN_TOLERANCE].includes(l.status)
    )
  ) {
    matchingStatus = MATCH_STATUS.WITHIN_TOLERANCE;
  } else {
    matchingStatus = MATCH_STATUS.MATCHED_WITH_VARIANCE;
  }

  return {
    matchingStatus,
    blocked,
    issues,
    lineResults,
    summary: { billedQty, receivedQty, orderedQty, billNet, receiptValue },
  };
}

/**
 * Load related docs and evaluate match for a bill id (DB-backed).
 */
export async function matchSupplierBill(tx, { tenantId, billId, requireReceiptForInventory = true }) {
  const bill = await tx.supplierBill.findFirst({
    where: { id: billId, tenantId },
    include: { items: true },
  });
  if (!bill) throw new Error('Supplier bill not found for matching');

  let purchaseOrder = null;
  let poItems = [];
  if (bill.purchaseOrderId) {
    purchaseOrder = await tx.purchaseOrder.findFirst({
      where: { id: bill.purchaseOrderId, tenantId },
      include: { items: true },
    });
    poItems = purchaseOrder?.items || [];
  }

  let goodsReceipt = null;
  let receiptItems = [];
  if (bill.goodsReceiptId) {
    goodsReceipt = await tx.goodsReceipt.findFirst({
      where: { id: bill.goodsReceiptId, tenantId },
      include: { items: true },
    });
    receiptItems = goodsReceipt?.items || [];
  }

  return evaluateThreeWayMatch({
    bill,
    billItems: bill.items,
    purchaseOrder,
    poItems,
    goodsReceipt,
    receiptItems,
    requireReceiptForInventory,
  });
}
