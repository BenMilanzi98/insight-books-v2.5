/** Canonical UI languages (allowlist). */
export const SUPPORTED_LOCALES = Object.freeze(['en', 'ny']);
export const DEFAULT_LOCALE = 'en';
export const LOCALE_COOKIE = 'ib_locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Keys that must stay English until glossary status APPROVED. */
export const CRITICAL_KEY_PREFIXES = Object.freeze([
  'accounting.',
  'tax-management.',
  'hr-payroll.',
  'reversals.',
  'reports.financial.',
]);

export const FORMATTING_LOCALE = Object.freeze({
  en: 'en-MW',
  ny: 'ny-MW',
});

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(String(value || '').toLowerCase());
}

export function normalizeLocale(value) {
  const v = String(value || '').toLowerCase().split('-')[0];
  if (v === 'ny' || v === 'nyan' || v === 'chichewa') return 'ny';
  if (v === 'en') return 'en';
  return null;
}

export function coerceLocale(value) {
  return normalizeLocale(value) || DEFAULT_LOCALE;
}

export function formattingLocaleFor(uiLocale) {
  const loc = coerceLocale(uiLocale);
  return FORMATTING_LOCALE[loc] || FORMATTING_LOCALE.en;
}

export function languageLabel(locale, displayLocale = locale) {
  const loc = coerceLocale(locale);
  const labels = {
    en: { en: 'English', ny: 'Chingerezi' },
    ny: { en: 'Chichewa', ny: 'Chichewa' },
  };
  return labels[loc]?.[coerceLocale(displayLocale)] || labels[loc]?.en || loc;
}
