/**
 * Read NPS percentages from TenantSettings row (raw SQL or Prisma).
 * No default 5% — null/undefined means "not configured" (0% in payroll math).
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
