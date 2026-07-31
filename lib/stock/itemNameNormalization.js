/**
 * Deterministic Item Name normalization for Business-scoped matching.
 * Matching never crosses tenants.
 */

const MULTI_SPACE = /\s+/g;
const UNICODE_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeItemName(raw) {
  if (raw == null) return '';
  let s = String(raw).normalize('NFKC');
  s = s.replace(UNICODE_SPACES, ' ');
  s = s.trim().replace(MULTI_SPACE, ' ');
  return s.toLocaleLowerCase('en-US');
}

/**
 * Display name: trim + collapse whitespace, preserve case.
 * @param {unknown} raw
 * @returns {string}
 */
export function canonicalizeItemDisplayName(raw) {
  if (raw == null) return '';
  let s = String(raw).normalize('NFKC');
  s = s.replace(UNICODE_SPACES, ' ');
  return s.trim().replace(MULTI_SPACE, ' ');
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, displayName: string, normalizedName: string } | { ok: false, code: string, message: string }}
 */
export function validateItemName(raw) {
  const displayName = canonicalizeItemDisplayName(raw);
  if (!displayName) {
    return { ok: false, code: 'EMPTY_ITEM_NAME', message: 'Item Name is required.' };
  }
  if (displayName.length > 200) {
    return { ok: false, code: 'ITEM_NAME_TOO_LONG', message: 'Item Name must be at most 200 characters.' };
  }
  if (!/[A-Za-z0-9\u00C0-\u024F]/.test(displayName)) {
    return { ok: false, code: 'ITEM_NAME_INVALID', message: 'Item Name must contain letters or numbers.' };
  }
  return {
    ok: true,
    displayName,
    normalizedName: normalizeItemName(displayName),
  };
}

/**
 * @template {{ id: string, name?: string|null, normalizedName?: string|null }} T
 * @param {T[]} products same Business only
 * @param {string} normalizedName
 * @returns {{ status: 'NONE' } | { status: 'MATCH', product: T } | { status: 'AMBIGUOUS', products: T[] }}
 */
export function matchProductsByNormalizedName(products, normalizedName) {
  const key = normalizeItemName(normalizedName);
  if (!key) return { status: 'NONE' };
  const hits = (products || []).filter((p) => {
    const n = p.normalizedName ? normalizeItemName(p.normalizedName) : normalizeItemName(p.name);
    return n === key;
  });
  if (hits.length === 0) return { status: 'NONE' };
  if (hits.length === 1) return { status: 'MATCH', product: hits[0] };
  return { status: 'AMBIGUOUS', products: hits };
}
