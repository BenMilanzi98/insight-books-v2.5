import {
  calculateDateRange,
  formatYmdInTimeZone,
  getAvailableTimeframes,
  getTimeframeLabel,
} from '@/lib/dateUtils';

export function isoDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PRESET_ALIASES = {
  this_year: 'thisYear',
  last_year: 'lastYear',
  this_quarter: 'thisQuarter',
  last_quarter: 'lastQuarter',
};

export function normalizePreset(preset) {
  return PRESET_ALIASES[preset] || preset;
}

export function rangeFromPreset(preset, custom = {}) {
  if (preset === 'custom') {
    return {
      fromDate: custom.fromDate || isoDate(new Date()),
      toDate: custom.toDate || isoDate(new Date()),
    };
  }
  const key = normalizePreset(preset);
  const { startDate, endDate } = calculateDateRange(key);
  return {
    fromDate: formatYmdInTimeZone(startDate),
    toDate: formatYmdInTimeZone(endDate),
  };
}

/** Align with Dashboard {@link getAvailableTimeframes} plus last week / last year. */
export const DATE_PRESETS = [
  ...getAvailableTimeframes(),
  { id: 'lastWeek', label: 'Last Week' },
  { id: 'lastYear', label: 'Last Year' },
].map((p) => ({ id: p.id ?? p.value, label: p.label }));

export function presetLabel(preset) {
  return getTimeframeLabel(normalizePreset(preset));
}

/** FreshBooks-style filter sections available per report type. */
export function filterConfigForReportType(type) {
  if (type === 'REPORTS_DASHBOARD') {
    return {
      asOf: false,
      groupBy: false,
      basis: false,
      breakdown: false,
      currency: false,
      includeZero: false,
    };
  }
  const asOf = type === 'BALANCE_SHEET' || type === 'RECEIVABLES' || type === 'PAYABLES';
  const groupBy = type === 'INCOME_STATEMENT';
  const basis = type === 'INCOME_STATEMENT';
  const breakdown = type === 'INCOME_STATEMENT';
  return {
    asOf,
    groupBy,
    basis,
    breakdown,
    currency: false,
    includeZero: type === 'TRIAL_BALANCE',
  };
}

export function defaultFilterDraft(type) {
  const range = rangeFromPreset('thisMonth');
  const config = filterConfigForReportType(type);
  return {
    preset: 'thisMonth',
    ...range,
    groupBy: config.groupBy ? 'MONTH' : undefined,
    reportBasis: config.basis ? 'ACCRUAL' : undefined,
    breakdown: config.breakdown ? 'ACCOUNT' : undefined,
    currency: null,
    includeZero: false,
  };
}
