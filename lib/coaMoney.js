/** CoA / GL display rounding — single rounding point to limit float drift. */
export const COA_RECONCILE_TOLERANCE = 0.005;

export function roundCents(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}
