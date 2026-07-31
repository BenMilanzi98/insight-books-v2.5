/**
 * Commercial line item normalization — Phase 15 Wave 2.
 */

import { normalizeBillingFrequency, normalizeProductRef } from './productConfig.js';

export function normalizeLineItem(raw = {}) {
  const productRef = normalizeProductRef(raw.productRef);
  const quantity = Number(raw.quantity);
  if (!productRef || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return {
    productRef,
    quantity,
    unit: raw.unit != null ? String(raw.unit).trim() : null,
    currency: raw.currency ? String(raw.currency).trim().toUpperCase() : null,
    billingFrequency: normalizeBillingFrequency(raw.billingFrequency),
    lineKey: raw.lineKey != null ? String(raw.lineKey) : null,
  };
}

export function normalizeLineItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  const normalized = [];
  for (const raw of items) {
    const item = normalizeLineItem(raw);
    if (!item) {
      return { ok: false, error: 'invalid_line_item', item: raw };
    }
    normalized.push(item);
  }
  return { ok: true, lineItems: normalized };
}

export function collectLineCurrencies(lineItems, documentCurrency) {
  const currencies = new Set();
  const doc = documentCurrency ? String(documentCurrency).trim().toUpperCase() : null;
  for (const item of lineItems || []) {
    const c = item.currency || doc;
    if (c) currencies.add(c);
  }
  return [...currencies];
}
