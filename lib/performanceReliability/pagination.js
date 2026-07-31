/**
 * Deterministic pagination bounds — Phase 17.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export function clampPageSize(take, { max = MAX_PAGE_SIZE, fallback = DEFAULT_PAGE_SIZE } = {}) {
  const n = Number(take);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * Cursor payload: opaque base64 JSON { id, sort }.
 */
export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
