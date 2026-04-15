/**
 * Coerce Prisma Decimal, string amounts, or mixed numeric types for CSV/export math.
 * Avoids `reduce((a,b) => a + b)` turning into string concatenation when any operand is a string.
 */
export function exportToNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && typeof value.toNumber === "function") {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/\s/g, "").trim();
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Sum line quantities (or other numeric fields) safely. */
export function exportSumField(items, field = "quantity") {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + exportToNumber(item?.[field]), 0);
}
