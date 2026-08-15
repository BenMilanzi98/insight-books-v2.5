/**
 * Critical financial/tax/payroll keys: use English until APPROVED.
 * Status map can grow; default for matching prefixes is FINANCIAL_REVIEW_REQUIRED.
 */
import { CRITICAL_KEY_PREFIXES } from './locales.js';

/** @type {Record<string, 'APPROVED' | 'FINANCIAL_REVIEW_REQUIRED' | 'HUMAN_REVIEW_REQUIRED' | 'MACHINE_ASSISTED'>} */
export const KEY_REVIEW_STATUS = {
  'navigation.dashboard': 'APPROVED',
  'common.language.english': 'APPROVED',
  'common.language.chichewa': 'APPROVED',
};

export function isCriticalKey(key) {
  const k = String(key || '');
  return CRITICAL_KEY_PREFIXES.some((p) => k.startsWith(p));
}

export function shouldUseEnglishForKey(key, requestedLocale) {
  // Full Chichewa UI: never force English while the user is in `ny`.
  if (requestedLocale === 'en') return false;
  return false;
}
