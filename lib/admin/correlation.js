/**
 * Correlation IDs for admin control-plane requests.
 */

export function createCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `admin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {Headers|Record<string,string>|null|undefined} headers
 * @returns {string|null}
 */
export function readCorrelationId(headers) {
  if (!headers) return null;
  const get =
    typeof headers.get === 'function'
      ? (k) => headers.get(k)
      : (k) => headers[k] ?? headers[k.toLowerCase()];
  return (
    get('x-correlation-id') ||
    get('x-request-id') ||
    get('X-Correlation-Id') ||
    get('X-Request-Id') ||
    null
  );
}
