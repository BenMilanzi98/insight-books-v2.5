/**
 * Operational insights for reports-v2 Sales / Expense tiles.
 * JE totals remain the financial source of truth; these figures are analysis only.
 */
import { addMoney, parseMoney } from '@/lib/money';

function ymd(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function eachDay(from, to) {
  const start = ymd(from);
  const end = ymd(to) || start;
  if (!start) return [];
  const days = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  for (let i = 0; i < 62 && cursor <= last; i += 1) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function loadSalesInsights(db, tenantId, fromDate, toDate) {
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;
  const dateFilter = from || to ? { gte: from, lte: to } : undefined;

  const [invoices, sales] = await Promise.all([
    db.invoice.findMany({
      where: {
        tenantId,
        status: { notIn: ['Void', 'void', 'Cancelled', 'cancelled', 'Draft', 'draft'] },
        ...(dateFilter ? { issueDate: dateFilter } : {}),
      },
      select: {
        id: true,
        total: true,
        issueDate: true,
        client: { select: { id: true, name: true } },
        items: { select: { description: true, quantity: true, amount: true, product: { select: { name: true } } } },
      },
      take: 5000,
    }).catch(() => []),
    db.sale.findMany({
      where: {
        tenantId,
        status: { equals: 'completed', mode: 'insensitive' },
        isReversal: false,
        voidedAt: null,
        refundedAt: null,
        ...(dateFilter ? { saleDate: dateFilter } : {}),
      },
      select: {
        id: true,
        total: true,
        saleDate: true,
        client: { select: { id: true, name: true } },
        items: { select: { description: true, quantity: true, amount: true, product: { select: { name: true } } } },
      },
      take: 5000,
    }).catch(() => []),
  ]);

  let totalSales = 0;
  const byCustomer = new Map();
  const byProduct = new Map();
  const byDay = new Map();
  const byMonth = new Map();

  const bump = (map, key, amount, extra = {}) => {
    const prev = map.get(key) || { amount: 0, count: 0, ...extra };
    prev.amount = addMoney(prev.amount, amount);
    prev.count += 1;
    map.set(key, prev);
  };

  const consume = (rows, dateField) => {
    for (const row of rows) {
      const amt = parseMoney(row.total);
      totalSales = addMoney(totalSales, amt);
      const customer = row.client?.name || 'Walk-in';
      bump(byCustomer, row.client?.id || customer, amt, { name: customer });
      const day = ymd(row[dateField]);
      if (day) {
        bump(byDay, day, amt, { date: day });
        bump(byMonth, day.slice(0, 7), amt, { month: day.slice(0, 7) });
      }
      for (const item of row.items || []) {
        const name = item.product?.name || item.description || 'Item';
        const line = parseMoney(item.amount);
        const prev = byProduct.get(name) || { name, amount: 0, quantity: 0 };
        prev.amount = addMoney(prev.amount, line);
        prev.quantity += Number(item.quantity || 0);
        byProduct.set(name, prev);
      }
    }
  };

  consume(invoices, 'issueDate');
  consume(sales, 'saleDate');

  const top = (map, n = 5) =>
    [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, n);

  return {
    source: 'invoices+pos',
    totalSales,
    invoiceCount: invoices.length,
    posCount: sales.length,
    topCustomers: top(byCustomer),
    topProducts: top(byProduct),
    dailyTrend: [...byDay.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    monthlyTrend: [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))),
  };
}

export async function loadExpenseInsights(db, tenantId, fromDate, toDate) {
  const from = fromDate ? new Date(fromDate) : undefined;
  const to = toDate ? new Date(toDate) : undefined;
  const expenses = await db.expense.findMany({
    where: {
      tenantId,
      isDeleted: false,
      isReversal: false,
      ...(from || to ? { date: { gte: from, lte: to } } : {}),
    },
    select: {
      id: true,
      amount: true,
      date: true,
      category: true,
      description: true,
      merchant: true,
    },
    take: 5000,
  }).catch(() => []);

  let total = 0;
  const byCategory = new Map();
  const byMonth = new Map();
  const largest = [];

  for (const exp of expenses) {
    const amt = parseMoney(exp.amount);
    total = addMoney(total, amt);
    const cat = exp.category || 'Uncategorised';
    const prev = byCategory.get(cat) || { category: cat, amount: 0, count: 0 };
    prev.amount = addMoney(prev.amount, amt);
    prev.count += 1;
    byCategory.set(cat, prev);
    const month = ymd(exp.date)?.slice(0, 7);
    if (month) {
      const m = byMonth.get(month) || { month, amount: 0, count: 0 };
      m.amount = addMoney(m.amount, amt);
      m.count += 1;
      byMonth.set(month, m);
    }
    largest.push({
      id: exp.id,
      amount: amt,
      date: exp.date,
      description: exp.description,
      merchant: exp.merchant,
      category: cat,
    });
  }

  largest.sort((a, b) => b.amount - a.amount);

  return {
    source: 'expense-documents',
    total,
    count: expenses.length,
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    trend: [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month))),
    largest: largest.slice(0, 10),
  };
}

export { ymd, eachDay };
