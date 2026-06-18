/**
 * Canonical salary expense is 5200 Salaries & Wages.
 * Retired duplicate 5301 is merged into 5200 for reporting.
 */

export const CANONICAL_SALARY_ACCOUNT_CODE = '5200';
export const CANONICAL_SALARY_ACCOUNT_NAME = 'Salaries & Wages';
export const DUPLICATE_SALARY_ACCOUNT_CODE = '5301';

/** Salary GL buckets — roll up to 5200 on the P&L. */
/** @type {Set<string>} */
export const LEGACY_SALARY_BUCKET_CODES = new Set([
  DUPLICATE_SALARY_ACCOUNT_CODE,
  '5201',
  '5202',
  '5203',
  '5230',
]);

/** @param {string|null|undefined} code */
export function isLegacySalaryBucketCode(code) {
  return LEGACY_SALARY_BUCKET_CODES.has(normalizeSalaryAccountCode(code));
}

/** @param {string|null|undefined} code */
export function normalizeSalaryAccountCode(code) {
  return String(code ?? '').trim().replace(/\s+/g, '');
}

/** @param {string|null|undefined} code */
export function isDuplicateSalaryAccountCode(code) {
  return normalizeSalaryAccountCode(code) === DUPLICATE_SALARY_ACCOUNT_CODE;
}

/** @param {string|null|undefined} code */
export function isCanonicalSalaryAccountCode(code) {
  return normalizeSalaryAccountCode(code) === CANONICAL_SALARY_ACCOUNT_CODE;
}

/**
 * @param {string|null|undefined} code
 * @returns {string|null}
 */
export function mapDuplicateSalaryCodeToCanonical(code) {
  return isDuplicateSalaryAccountCode(code) ? CANONICAL_SALARY_ACCOUNT_CODE : normalizeSalaryAccountCode(code) || null;
}
