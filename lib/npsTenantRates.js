/**
 * Read NPS percentages from TenantSettings row (raw SQL or Prisma).
 * Raw null/undefined means the field was not set in the DB (see {@link effectiveNpsRatePercentForPayroll} for payroll defaults).
 * PostgreSQL may return lowercase column names.
 */
export function npsRatesFromTenantSettingsRow(row) {
  if (!row || typeof row !== 'object') {
    return { npsEmployeeRatePercent: null, npsEmployerRatePercent: null };
  }
  const empRaw = row.npsEmployeeRatePercent ?? row.npsemployeeratepercent;
  const erRaw = row.npsEmployerRatePercent ?? row.npsemployerratepercent;

  const parse = (v) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    npsEmployeeRatePercent: parse(empRaw),
    npsEmployerRatePercent: parse(erRaw),
  };
}

/**
 * Effective NPS rate in **percentage points** (e.g. `5` = 5%, `3.5` = 3.5%) for payroll math.
 * - Honors tenant **custom** values whenever they parse as a finite number (including `0`).
 * - When statutory NPS applies for the employee but the tenant has not set this side in DB,
 *   uses Malawi statutory default (5% each side unless overridden).
 *
 * @param {unknown} raw - `TenantSettings` value (or option passed through from API)
 * @param {boolean} npsDeductionSelected - Employee has statutory NPS / pension deduction selected
 * @param {number} [statutoryDefaultPercent=5] - Used only when `npsDeductionSelected` and `raw` is unset/invalid
 * @returns {number}
 */
export function effectiveNpsRatePercentForPayroll(
  raw,
  npsDeductionSelected,
  statutoryDefaultPercent = 5,
) {
  if (!npsDeductionSelected) return 0;
  if (raw !== null && raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return Number(statutoryDefaultPercent) || 0;
}
