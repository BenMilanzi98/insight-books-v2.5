/**
 * Inventory loss events from InventoryTransaction (operational SoT),
 * optionally joined to expense/JE amounts for money recon.
 */

const LOSS_TYPE_MATCHERS = [
  { eventType: 'write_off', test: (t) => /write.?off|adjustment/i.test(t) && !/stock\s*in/i.test(t) },
  { eventType: 'stock_out', test: (t) => /stock\s*out|stock_out/i.test(t) },
];

function classifyLossType(type, quantity) {
  const raw = String(type || '');
  for (const m of LOSS_TYPE_MATCHERS) {
    if (m.test(raw)) return m.eventType;
  }
  const qty = Number(quantity) || 0;
  if (qty < 0) return 'stock_out';
  return null;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {import('@prisma/client').PrismaClient} db
 * @param {{ tenantId: string, startDate?: Date, endDate?: Date, eventType?: string }} opts
 */
export async function buildInventoryLossFromStock(db, opts) {
  const { tenantId, startDate, endDate, eventType = 'all' } = opts;
  if (!tenantId) {
    return {
      items: [],
      summary: {
        totalAmount: 0,
        totalCount: 0,
        writeOffAmount: 0,
        writeOffCount: 0,
        stockOutAmount: 0,
        stockOutCount: 0,
      },
      byMonth: [],
    };
  }

  const where = {
    tenantId,
    OR: [
      { type: { contains: 'Stock Out', mode: 'insensitive' } },
      { type: { contains: 'stock_out', mode: 'insensitive' } },
      { type: { contains: 'write', mode: 'insensitive' } },
      { type: { contains: 'adjustment', mode: 'insensitive' } },
    ],
  };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const rows = await db.inventoryTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 2000,
    include: {
      product: { select: { id: true, name: true, sku: true, cost: true, totalStockValue: true } },
      user: { select: { id: true, name: true } },
    },
  });

  const expenses = await db.expense.findMany({
    where: {
      tenantId,
      isDeleted: false,
      originalReference: { startsWith: 'inventory-' },
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    select: { originalReference: true, amount: true, description: true },
  });
  const expenseBySource = new Map();
  for (const e of expenses) {
    const src = String(e.originalReference || '').split(':').slice(1).join(':');
    if (src) expenseBySource.set(src, e);
  }

  const items = [];
  for (const row of rows) {
    const qty = toNum(row.quantity);
    const classified = classifyLossType(row.type, qty);
    if (!classified) continue;
    if (classified === 'stock_out' && qty > 0) continue;
    if (eventType !== 'all' && classified !== eventType) continue;

    const absQty = Math.abs(qty);
    const unitCost = toNum(row.product?.cost);
    const expense = expenseBySource.get(row.id) || null;
    const amount = expense ? toNum(expense.amount) : Math.round(absQty * Math.max(0, unitCost) * 100) / 100;

    items.push({
      id: row.id,
      date: row.createdAt,
      eventType: classified,
      quantity: absQty,
      amount,
      description: row.notes || expense?.description || `${classified === 'write_off' ? 'Write-off' : 'Stock-out'} — ${row.product?.name || 'Product'}`,
      productId: row.productId,
      productName: row.product?.name || 'Unknown',
      productSku: row.product?.sku || null,
      reference: row.id,
      sourceId: row.id,
      sourceLabel: row.product?.name || null,
      submittedBy: row.user?.name || 'Unknown',
      notes: row.notes || null,
    });
  }

  const summary = {
    totalAmount: 0,
    totalCount: items.length,
    writeOffAmount: 0,
    writeOffCount: 0,
    stockOutAmount: 0,
    stockOutCount: 0,
  };
  const monthMap = new Map();
  for (const item of items) {
    summary.totalAmount += item.amount;
    if (item.eventType === 'write_off') {
      summary.writeOffAmount += item.amount;
      summary.writeOffCount += 1;
    } else {
      summary.stockOutAmount += item.amount;
      summary.stockOutCount += 1;
    }
    const d = item.date instanceof Date ? item.date : new Date(item.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(month) || {
      month,
      writeOffAmount: 0,
      stockOutAmount: 0,
      totalAmount: 0,
      count: 0,
    };
    bucket.totalAmount += item.amount;
    bucket.count += 1;
    if (item.eventType === 'write_off') bucket.writeOffAmount += item.amount;
    else bucket.stockOutAmount += item.amount;
    monthMap.set(month, bucket);
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  summary.totalAmount = round2(summary.totalAmount);
  summary.writeOffAmount = round2(summary.writeOffAmount);
  summary.stockOutAmount = round2(summary.stockOutAmount);

  return {
    items,
    summary,
    byMonth: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
