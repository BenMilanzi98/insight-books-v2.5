/**
 * CoA classification for Budget & Forecast lines (expense budget vs revenue forecast).
 */

function normType(acc) {
  const raw = acc?.accountType || acc?.type || '';
  return String(raw).trim().toLowerCase();
}

/** Prisma `account` filter: expense / COGS rows (tenant still required on parent where). */
export const COA_EXPENSE_ACCOUNT_OR = [
  { accountType: { equals: 'Expense', mode: 'insensitive' } },
  { type: { equals: 'Expense', mode: 'insensitive' } },
  { accountType: { equals: 'Cost of Goods Sold', mode: 'insensitive' } },
  { type: { equals: 'Cost of Goods Sold', mode: 'insensitive' } },
  { accountType: { equals: 'COGS', mode: 'insensitive' } },
  { type: { equals: 'COGS', mode: 'insensitive' } },
];

export function isBfExpenseAccount(acc) {
  const t = normType(acc);
  if (!t) return false;
  if (t === 'expense') return true;
  if (t.includes('expense')) return true;
  if (t.includes('cost of goods')) return true;
  if (t === 'cogs' || t === 'cost of goods sold') return true;
  return false;
}

export function isBfRevenueAccount(acc) {
  const t = normType(acc);
  return t === 'income' || t === 'revenue';
}
