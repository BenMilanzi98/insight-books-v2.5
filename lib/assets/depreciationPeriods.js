/**
 * Depreciation period presets — fraction of one year of useful life.
 * Used by Calculate Depreciation modal + /api/assets/depreciation.
 */

export const DEPRECIATION_PERIOD_PRESETS = Object.freeze([
  { id: 'hour', label: 'Hour', count: 1 },
  { id: 'day', label: 'Day', count: 1 },
  { id: 'week', label: 'Week', count: 1 },
  { id: 'month', label: 'Month', count: 1 },
  { id: 'quarter', label: 'Quarter', count: 1 },
  { id: 'year', label: 'Year', count: 1 },
  { id: 'custom', label: 'Custom range', count: 1 },
]);

/** Share of a full year for one unit of each preset (calendar convention). */
export const YEAR_FRACTION_PER_UNIT = Object.freeze({
  hour: 1 / (365.25 * 24),
  day: 1 / 365.25,
  week: 1 / 52,
  month: 1 / 12,
  quarter: 1 / 4,
  year: 1,
});

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * @param {string} frequency
 * @param {number} [count=1]
 * @returns {number} fraction of one year
 */
export function yearFractionForFrequency(frequency, count = 1) {
  const unit = YEAR_FRACTION_PER_UNIT[frequency];
  if (unit == null) return null;
  const n = Number(count);
  return unit * (Number.isFinite(n) && n > 0 ? n : 1);
}

/**
 * Exact proration from start→end timestamps (custom ranges).
 */
export function yearFractionFromDates(startDate, endDate) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  const ms = Math.max(0, end.getTime() - start.getTime());
  // Inclusive calendar day when both are date-only midnight and same-or-later day
  const isDateOnly =
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    end.getUTCHours() === 0 &&
    end.getUTCMinutes() === 0;
  if (isDateOnly) {
    const days = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) || 1);
    return days / 365.25;
  }
  return Math.max(ms / MS_PER_YEAR, YEAR_FRACTION_PER_UNIT.hour);
}

/**
 * Build period start/end for a preset ending at `anchor` (default now).
 * @returns {{ periodStart: Date, periodEnd: Date }}
 */
export function rangeForPreset(frequency, count = 1, anchor = new Date()) {
  const end = new Date(anchor);
  const start = new Date(anchor);
  const n = Math.max(1, Number(count) || 1);

  switch (frequency) {
    case 'hour':
      start.setTime(end.getTime() - n * 60 * 60 * 1000);
      break;
    case 'day':
      start.setTime(end.getTime() - n * 24 * 60 * 60 * 1000);
      break;
    case 'week':
      start.setTime(end.getTime() - n * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start.setMonth(start.getMonth() - n);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - n * 3);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - n);
      break;
    default:
      break;
  }
  return { periodStart: start, periodEnd: end };
}

export function toInputDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Annual charge for the asset, then × yearFraction.
 * Caps so remaining book value is not driven below zero.
 */
export function calcDepreciationAmount(asset, { frequency, periodCount, startDate, endDate }) {
  const usefulLife = asset.usefulLifeYears || 1;
  let yearFraction =
    frequency && frequency !== 'custom'
      ? yearFractionForFrequency(frequency, periodCount)
      : yearFractionFromDates(startDate, endDate);

  if (yearFraction == null || !Number.isFinite(yearFraction) || yearFraction <= 0) {
    yearFraction = yearFractionFromDates(startDate, endDate);
  }

  let amount;
  if (asset.depreciationMethod === 'declining_balance') {
    const rate = 2 / usefulLife;
    const currentValue = Math.max(0, asset.originalCost - (asset.accumulatedDepreciation || 0));
    amount = currentValue * rate * yearFraction;
  } else {
    const annualDepreciation = asset.originalCost / usefulLife;
    amount = annualDepreciation * yearFraction;
  }

  const bookValue = Math.max(0, asset.originalCost - (asset.accumulatedDepreciation || 0));
  return Math.max(0, Math.min(amount, bookValue));
}
