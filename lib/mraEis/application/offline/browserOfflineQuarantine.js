/**
 * Phase 16 — Quarantine legacy browser offline POS paths for MRA EIS.
 * IndexedDB / localStorage / navigator.onLine are NOT certified offline fiscalization.
 */

export const LEGACY_BROWSER_OFFLINE_CLASSIFICATION = Object.freeze({
  offlineSalesQueueJs: 'UNSAFE_BROWSER_ONLY',
  serviceWorker: 'UNSAFE_BROWSER_ONLY',
  navigatorOnline: 'UNSAFE_BROWSER_ONLY',
  indexedDbQueue: 'UNSAFE_BROWSER_ONLY',
  localStorageFiscal: 'UNSAFE_BROWSER_ONLY',
  androidSharedPreferencesQueue: 'UNSAFE_BROWSER_ONLY',
});

/**
 * Authoritative EIS offline entry must never be granted from browser storage signals.
 */
export function evaluateBrowserOfflineAuthoritativeRequest({
  source = 'UNKNOWN',
  usesIndexedDb = false,
  usesLocalStorage = false,
  usesNavigatorOnline = false,
  requestsMraFiscalOffline = false,
} = {}) {
  const blockers = [];
  if (requestsMraFiscalOffline) {
    blockers.push('BROWSER_ONLY_PROHIBITED');
  }
  if (usesIndexedDb) blockers.push('INDEXEDDB_NOT_AUTHORITATIVE_FISCAL_STORAGE');
  if (usesLocalStorage) blockers.push('LOCALSTORAGE_NOT_AUTHORITATIVE_FISCAL_STORAGE');
  if (usesNavigatorOnline) blockers.push('NAVIGATOR_ONLINE_INSUFFICIENT');

  return {
    allowed: false,
    authoritative: false,
    source,
    classification: LEGACY_BROWSER_OFFLINE_CLASSIFICATION,
    blockers: blockers.length ? blockers : ['BROWSER_ONLY_PROHIBITED'],
    message:
      'Certified MRA EIS offline fiscalization requires a trusted non-browser agent. Legacy POS offline queues remain non-fiscal.',
    migrateToPhase19: true,
  };
}

export function denyBrowserForceOfflineEntry() {
  return evaluateBrowserOfflineAuthoritativeRequest({
    source: 'CASHIER_FORCE_TOGGLE',
    requestsMraFiscalOffline: true,
    usesNavigatorOnline: true,
  });
}
