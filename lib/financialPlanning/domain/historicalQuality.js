import { DataQualityStatus } from './enums.js';

/**
 * Assess planning historical data quality from period coverage metadata.
 * Does not invent missing months.
 */
export function assessHistoricalDataQuality({
  periodCount = 0,
  closedPeriodCount = 0,
  missingMonths = 0,
  materialExceptions = 0,
  unbalancedPeriods = 0,
  lookbackMonths = 24,
} = {}) {
  const factors = [];
  if (periodCount < 6) factors.push('fewer than 6 historical periods');
  if (closedPeriodCount < periodCount * 0.5) factors.push('majority of periods are provisional');
  if (missingMonths > 0) factors.push(`${missingMonths} missing months disclosed`);
  if (materialExceptions > 0) factors.push(`${materialExceptions} material exceptions`);
  if (unbalancedPeriods > 0) factors.push(`${unbalancedPeriods} unbalanced source periods`);

  let status = DataQualityStatus.HIGH_CONFIDENCE;
  if (periodCount < 3 || unbalancedPeriods > 0) {
    status = DataQualityStatus.UNSUITABLE_FOR_AUTOMATIC_BASELINE;
  } else if (materialExceptions > 0) {
    status = DataQualityStatus.MATERIAL_EXCEPTIONS;
  } else if (missingMonths > 2 || periodCount < 6) {
    status = DataQualityStatus.INCOMPLETE;
  } else if (periodCount < lookbackMonths / 2 || closedPeriodCount < periodCount * 0.75) {
    status = DataQualityStatus.LIMITED_HISTORY;
  } else if (factors.length) {
    status = DataQualityStatus.MODERATE_CONFIDENCE;
  }

  return {
    status,
    periodCount,
    closedPeriodCount,
    missingMonths,
    materialExceptions,
    unbalancedPeriods,
    factors,
    suitableForAutomaticBaseline:
      status !== DataQualityStatus.UNSUITABLE_FOR_AUTOMATIC_BASELINE &&
      status !== DataQualityStatus.INCOMPLETE &&
      status !== DataQualityStatus.MATERIAL_EXCEPTIONS,
  };
}

/**
 * Simple seasonal indices from monthly series (bps, average = 10000).
 * Requires >= 12 points; returns null confidence otherwise.
 */
export function buildSeasonalIndices(monthlyAmounts = []) {
  if (!Array.isArray(monthlyAmounts) || monthlyAmounts.length < 12) {
    return {
      indicesBps: null,
      confidence: 'INSUFFICIENT_DATA',
      note: 'Seasonality requires at least 12 historical months.',
    };
  }
  const buckets = Array.from({ length: 12 }, () => ({ sum: 0, n: 0 }));
  monthlyAmounts.forEach((v, i) => {
    const amt = Number(v) || 0;
    const m = i % 12;
    buckets[m].sum += amt;
    buckets[m].n += 1;
  });
  const avgs = buckets.map((b) => (b.n ? b.sum / b.n : 0));
  const overall = avgs.reduce((s, x) => s + x, 0) / 12;
  if (overall === 0) {
    return { indicesBps: Array(12).fill(10000), confidence: 'LOW', note: 'Zero average history.' };
  }
  const indicesBps = avgs.map((a) => Math.round((a / overall) * 10000));
  return {
    indicesBps,
    confidence: monthlyAmounts.length >= 24 ? 'MODERATE' : 'LOW',
    note: 'Normalized monthly seasonal indices (average ≈ 10000 bps). Review before use.',
  };
}
