/**
 * Employment contract helpers — overlap rules and pay-basis resolution.
 * Payroll must use the contract effective for the pay period (caller loads by date).
 */

export const CONTRACT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  SUPERSEDED: 'SUPERSEDED',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
});

export const PAY_BASES = Object.freeze({
  MONTHLY_SALARY: 'MONTHLY_SALARY',
  WEEKLY_SALARY: 'WEEKLY_SALARY',
  FORTNIGHTLY_SALARY: 'FORTNIGHTLY_SALARY',
  DAILY_RATE: 'DAILY_RATE',
  HOURLY_RATE: 'HOURLY_RATE',
  HYBRID: 'HYBRID',
});

const ACTIVE_LIKE = new Set([
  CONTRACT_STATUSES.ACTIVE,
  CONTRACT_STATUSES.PENDING_APPROVAL,
]);

function toTime(d) {
  if (d == null) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Inclusive range overlap: [from, to|∞). */
export function contractsOverlap(a, b) {
  const aFrom = toTime(a.effectiveFrom);
  const bFrom = toTime(b.effectiveFrom);
  if (aFrom == null || bFrom == null) return false;
  const aTo = toTime(a.effectiveTo);
  const bTo = toTime(b.effectiveTo);
  const aEnd = aTo == null ? Number.POSITIVE_INFINITY : aTo;
  const bEnd = bTo == null ? Number.POSITIVE_INFINITY : bTo;
  return aFrom <= bEnd && bFrom <= aEnd;
}

/**
 * @param {Array<{ id?: string, status: string, effectiveFrom: Date|string, effectiveTo?: Date|string|null }>} existing
 * @param {{ id?: string, status: string, effectiveFrom: Date|string, effectiveTo?: Date|string|null }} candidate
 */
export function assertNoActiveContractOverlap(existing, candidate) {
  if (!ACTIVE_LIKE.has(candidate.status)) return true;
  const list = Array.isArray(existing) ? existing : [];
  for (const row of list) {
    if (candidate.id && row.id === candidate.id) continue;
    if (!ACTIVE_LIKE.has(row.status)) continue;
    if (contractsOverlap(row, candidate)) {
      throw new Error(
        'Active employment contracts overlap for this employee. Supersede or end the existing contract first.'
      );
    }
  }
  return true;
}

/**
 * Prefer explicit payBasis. Do not invent HYBRID from both fields being set.
 */
export function resolvePayBasis(input = {}) {
  const explicit = input.payBasis != null ? String(input.payBasis).trim() : '';
  if (explicit && Object.values(PAY_BASES).includes(explicit)) return explicit;

  const hourly = input.hourlyRate != null && Number(input.hourlyRate) > 0;
  const daily = input.dailyRate != null && Number(input.dailyRate) > 0;
  const monthly =
    (input.basicSalary != null && Number(input.basicSalary) > 0) ||
    (input.salary != null && Number(input.salary) > 0);

  if (hourly && !monthly && !daily) return PAY_BASES.HOURLY_RATE;
  if (daily && !monthly && !hourly) return PAY_BASES.DAILY_RATE;
  return PAY_BASES.MONTHLY_SALARY;
}

/** Pick contract covering `asOf` (inclusive). Prefers ACTIVE. */
export function pickContractForDate(contracts, asOf) {
  const t = toTime(asOf);
  if (t == null || !Array.isArray(contracts)) return null;
  const covering = contracts.filter((c) => {
    const from = toTime(c.effectiveFrom);
    if (from == null || from > t) return false;
    const to = toTime(c.effectiveTo);
    if (to != null && to < t) return false;
    return true;
  });
  covering.sort((a, b) => {
    const rank = (s) => (s === CONTRACT_STATUSES.ACTIVE ? 0 : 1);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return toTime(b.effectiveFrom) - toTime(a.effectiveFrom);
  });
  return covering[0] || null;
}
