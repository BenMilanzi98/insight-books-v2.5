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
  if (requestedLocale === 'en') return false;
  const status = KEY_REVIEW_STATUS[key];
  if (status === 'APPROVED') return false;
  if (status === 'FINANCIAL_REVIEW_REQUIRED' || status === 'HUMAN_REVIEW_REQUIRED') {
    return true;
  }
  // Unlisted critical-prefix keys fall back to English until approved.
  return isCriticalKey(key);
}
