/**
 * Browser console policy for client bundles.
 *
 * Default:
 *   - development → logs enabled
 *   - production  → logs disabled
 *
 * Override with NEXT_PUBLIC_CLIENT_CONSOLE_LOGS:
 *   true | 1 | yes | on  → force enable
 *   false | 0 | no | off → force disable
 */

const METHODS = ['log', 'debug', 'info', 'warn', 'error', 'trace', 'table', 'group', 'groupCollapsed', 'groupEnd'];

function parseFlag(raw) {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (!v) return null;
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return null;
}

/** @returns {boolean} */
export function isClientConsoleEnabled() {
  const override = parseFlag(process.env.NEXT_PUBLIC_CLIENT_CONSOLE_LOGS);
  if (override != null) return override;
  return process.env.NODE_ENV !== 'production';
}

/**
 * No-op console methods in the browser when policy is disabled.
 * Safe to call multiple times (idempotent).
 */
export function applyClientConsolePolicy() {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;
  if (window.__IB_CLIENT_CONSOLE_POLICY_APPLIED__) return;
  window.__IB_CLIENT_CONSOLE_POLICY_APPLIED__ = true;

  if (isClientConsoleEnabled()) return;

  const noop = () => {};
  for (const method of METHODS) {
    try {
      if (typeof console[method] === 'function') {
        console[method] = noop;
      }
    } catch {
      /* ignore non-configurable */
    }
  }
}
