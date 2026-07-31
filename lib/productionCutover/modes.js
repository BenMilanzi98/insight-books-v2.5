/**
 * Phase 18 cutover modes — server-enforced via CUTOVER_MODE env (and optional header override for ops).
 * Values: off | maintenance | readonly | write_freeze
 *
 * Never trust client-provided roles for mode bypass.
 */

export const CUTOVER_MODES = Object.freeze({
  OFF: 'off',
  MAINTENANCE: 'maintenance',
  READONLY: 'readonly',
  WRITE_FREEZE: 'write_freeze',
});

/** Paths always allowed (health, login, cutover status). */
export const CUTOVER_ALWAYS_ALLOW = [
  '/api/system/health',
  '/api/system/cutover',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/page-guard',
  '/api/auth/api-guard',
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/suspended',
  '/maintenance',
];

/** Prefixes that may write during maintenance (ops / admin only — still require auth at handler). */
export const CUTOVER_OPS_PREFIXES = [
  '/insightbooks',
  '/api/admin',
  '/api/system/cutover',
];

export function getCutoverMode() {
  const raw = String(process.env.CUTOVER_MODE || 'off').toLowerCase().trim();
  if (Object.values(CUTOVER_MODES).includes(raw)) return raw;
  return CUTOVER_MODES.OFF;
}

export function isCutoverWriteBlocked(mode = getCutoverMode()) {
  return (
    mode === CUTOVER_MODES.MAINTENANCE ||
    mode === CUTOVER_MODES.READONLY ||
    mode === CUTOVER_MODES.WRITE_FREEZE
  );
}

export function isFinancialWriteMethod(method) {
  const m = String(method || 'GET').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

export function pathAlwaysAllowed(pathname) {
  return CUTOVER_ALWAYS_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function pathIsOps(pathname) {
  return CUTOVER_OPS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Evaluate whether a request may proceed under current cutover mode.
 * @returns {{ allow: boolean, code?: string, status?: number, mode: string, message?: string }}
 */
export function evaluateCutoverAccess({ pathname, method }) {
  const mode = getCutoverMode();
  if (mode === CUTOVER_MODES.OFF) {
    return { allow: true, mode };
  }

  if (pathAlwaysAllowed(pathname)) {
    return { allow: true, mode };
  }

  if (mode === CUTOVER_MODES.MAINTENANCE) {
    if (pathIsOps(pathname)) return { allow: true, mode };
    return {
      allow: false,
      mode,
      status: 503,
      code: 'CUTOVER_MAINTENANCE',
      message:
        process.env.CUTOVER_MESSAGE ||
        'InsightBooks is in maintenance for production cutover. Please retry later.',
    };
  }

  // readonly / write_freeze: block financial write methods (except ops)
  if (isCutoverWriteBlocked(mode) && isFinancialWriteMethod(method)) {
    if (pathIsOps(pathname)) return { allow: true, mode };
    return {
      allow: false,
      mode,
      status: 503,
      code: mode === CUTOVER_MODES.WRITE_FREEZE ? 'LEGACY_WRITE_FREEZE' : 'CUTOVER_READONLY',
      message:
        process.env.CUTOVER_MESSAGE ||
        'Financial writes are frozen during cutover. Reads remain available.',
    };
  }

  return { allow: true, mode };
}
