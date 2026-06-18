/**
 * Persistent business scope selection (shared across dashboard, reports, accounting).
 */

export const BUSINESS_SCOPE_STORAGE_KEY = 'insightbooks:business-scope';
export const BUSINESS_SCOPE_IDS_KEY = 'insightbooks:business-scope-tenant-ids';
export const REPORTING_CURRENCY_STORAGE_KEY = 'insightbooks:reporting-currency';

/** Common group reporting currencies (matches lib/currencyService defaults). */
export const REPORTING_CURRENCY_OPTIONS = ['MWK', 'USD', 'EUR', 'GBP', 'ZAR'];

/** @typedef {'session' | 'all' | 'custom'} BusinessScopeMode */

/**
 * @returns {{ mode: BusinessScopeMode, tenantIds: string[] }}
 */
export function readBusinessScopeFromStorage() {
  if (typeof window === 'undefined') {
    return { mode: 'session', tenantIds: [] };
  }
  try {
    const mode = localStorage.getItem(BUSINESS_SCOPE_STORAGE_KEY) || 'session';
    const rawIds = localStorage.getItem(BUSINESS_SCOPE_IDS_KEY);
    const tenantIds = rawIds ? JSON.parse(rawIds) : [];
    return {
      mode: mode === 'all' || mode === 'custom' ? mode : 'session',
      tenantIds: Array.isArray(tenantIds) ? tenantIds.filter(Boolean) : [],
    };
  } catch {
    return { mode: 'session', tenantIds: [] };
  }
}

/**
 * @param {BusinessScopeMode} mode
 * @param {string[]} tenantIds
 */
export function writeBusinessScopeToStorage(mode, tenantIds = []) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BUSINESS_SCOPE_STORAGE_KEY, mode);
  localStorage.setItem(BUSINESS_SCOPE_IDS_KEY, JSON.stringify(tenantIds.filter(Boolean)));
}

/**
 * Append scope query params to URLSearchParams for API calls.
 * @param {URLSearchParams} params
 * @param {{ mode: BusinessScopeMode, tenantIds: string[] }} scope
 */
export function appendBusinessScopeParams(params, scope) {
  if (!scope || scope.mode === 'session') {
    appendReportingCurrencyParam(params, scope?.reportingCurrency);
    return params;
  }
  if (scope.mode === 'all') {
    params.set('aggregate', 'all');
  } else if (scope.mode === 'custom' && scope.tenantIds?.length) {
    params.set('tenantIds', scope.tenantIds.join(','));
  }
  appendReportingCurrencyParam(params, scope?.reportingCurrency);
  return params;
}

/**
 * @returns {string|null}
 */
export function readReportingCurrencyFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = String(localStorage.getItem(REPORTING_CURRENCY_STORAGE_KEY) || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * @param {string|null|undefined} currency
 */
export function writeReportingCurrencyToStorage(currency) {
  if (typeof window === 'undefined') return;
  const normalized = String(currency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    localStorage.setItem(REPORTING_CURRENCY_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(REPORTING_CURRENCY_STORAGE_KEY);
  }
}

/**
 * @param {URLSearchParams} params
 * @param {string|null|undefined} reportingCurrency
 */
export function appendReportingCurrencyParam(params, reportingCurrency) {
  const code = String(reportingCurrency || '').trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    params.set('reportingCurrency', code);
  }
  return params;
}

/**
 * Build query string suffix for fetch URLs.
 */
export function businessScopeQueryString(scope) {
  const params = new URLSearchParams();
  appendBusinessScopeParams(params, scope);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}
