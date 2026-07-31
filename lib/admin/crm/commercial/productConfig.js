/**
 * Product configuration helpers for commercial pricing — Phase 15 Wave 2.
 * Product refs pin to Price Book entries; Opp estimates remain non-binding.
 */

export function normalizeProductRef(raw) {
  const ref = raw != null ? String(raw).trim() : '';
  return ref || null;
}

export function normalizeBillingFrequency(raw, fallback = 'MONTHLY') {
  const f = String(raw || fallback).trim().toUpperCase();
  const allowed = new Set(['MONTHLY', 'ANNUAL', 'ONE_TIME', 'QUARTERLY']);
  return allowed.has(f) ? f : fallback;
}

/**
 * Resolve a Price Book entry for a product ref within a version.
 */
export function findPriceBookEntryForProduct(entries, productRef) {
  const ref = normalizeProductRef(productRef);
  if (!ref || !Array.isArray(entries)) return null;
  return entries.find((e) => String(e.productRef || '').trim() === ref) || null;
}

/**
 * Opp commercial estimates are non-binding and must never be treated as Price Book prices.
 */
export function assertNotOpportunityEstimateAsPriceBook(source) {
  const s = String(source || '').trim().toUpperCase();
  if (s === 'OPPORTUNITY_ESTIMATE' || s === 'OPP_ESTIMATE' || s === 'UNIT_AMOUNT_ESTIMATE') {
    return {
      ok: false,
      error: 'opportunity_estimate_non_binding',
      reason: 'Opp estimates must not be used as Price Book prices',
    };
  }
  return { ok: true };
}
