import { parseMoney, roundMoney, sumMoney } from '@/lib/money';

/**
 * Coerce Prisma Decimal, string amounts, or mixed numeric types for CSV/export math.
 */
export function exportToNumber(value) {
  return roundMoney(parseMoney(value));
}

/** Sum line quantities (or other numeric fields) safely. */
export function exportSumField(items, field = "quantity") {
  if (!Array.isArray(items)) return 0;
  return sumMoney(items.map((item) => exportToNumber(item?.[field])));
}
