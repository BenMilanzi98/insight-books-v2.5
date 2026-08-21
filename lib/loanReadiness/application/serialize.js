/**
 * JSON-safe values for Loan Readiness API responses (Prisma BigInt → string).
 */

export function serializeLoanReadiness(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeLoanReadiness);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeLoanReadiness(v);
    }
    return out;
  }
  return value;
}
