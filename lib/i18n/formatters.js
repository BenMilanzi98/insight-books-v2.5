import { formattingLocaleFor, coerceLocale } from './locales.js';

/**
 * Presentation formatters only — never convert currency or alter decimal authority.
 */
export function formatNumber(value, { locale = 'en', maximumFractionDigits = 2 } = {}) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return new Intl.NumberFormat(formattingLocaleFor(locale), {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatCurrency(
  value,
  { locale = 'en', currencyCode = 'MWK', maximumFractionDigits = 2 } = {}
) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  try {
    return new Intl.NumberFormat(formattingLocaleFor(locale), {
      style: 'currency',
      currency: currencyCode || 'MWK',
      maximumFractionDigits,
      minimumFractionDigits: maximumFractionDigits,
    }).format(n);
  } catch {
    return `${currencyCode || 'MWK'} ${formatNumber(n, { locale, maximumFractionDigits })}`;
  }
}

export function formatPercentage(value, { locale = 'en', maximumFractionDigits = 2 } = {}) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return new Intl.NumberFormat(formattingLocaleFor(locale), {
    style: 'percent',
    maximumFractionDigits,
  }).format(n > 1 ? n / 100 : n);
}

export function formatDate(value, { locale = 'en', dateStyle = 'medium' } = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(formattingLocaleFor(locale), { dateStyle }).format(d);
}

export function formatDateTime(value, { locale = 'en' } = {}) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(formattingLocaleFor(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export function htmlLang(locale) {
  return coerceLocale(locale);
}
