/**
 * Explicit FX snapshots for commercial pricing — Phase 15 Wave 2.
 * Missing/stale → FX_CONTEXT_MISSING / STALE. Never silent convert.
 * Never fabricate a combined multi-currency total.
 */

import { CRM_FX_RELIABILITY } from './catalogue.js';

const STALE_MS_DEFAULT = 24 * 60 * 60 * 1000;

/**
 * Validate FX context when source currency ≠ document currency.
 * @returns {{ ok: true, reliability, rate, snapshot } | { ok: false, error, reliability }}
 */
export function resolveFxContext({
  sourceCurrency,
  targetCurrency,
  fxContext,
  calculationDate,
  now,
  staleMs = STALE_MS_DEFAULT,
} = {}) {
  const source = sourceCurrency ? String(sourceCurrency).trim().toUpperCase() : null;
  const target = targetCurrency ? String(targetCurrency).trim().toUpperCase() : null;

  if (!source || !target || source === target) {
    return {
      ok: true,
      reliability: CRM_FX_RELIABILITY.OK,
      rate: 1,
      snapshot: null,
      converted: false,
    };
  }

  if (!fxContext || typeof fxContext !== 'object') {
    return {
      ok: false,
      error: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
      reliability: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
    };
  }

  const rate = Number(fxContext.rate);
  const namedSource = fxContext.source || fxContext.namedSource;
  const effectiveAt = fxContext.effectiveAt || fxContext.effectiveTimestamp;
  const ctxSource = fxContext.sourceCurrency
    ? String(fxContext.sourceCurrency).trim().toUpperCase()
    : null;
  const ctxTarget = fxContext.targetCurrency
    ? String(fxContext.targetCurrency).trim().toUpperCase()
    : null;

  if (
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !namedSource ||
    !effectiveAt ||
    (ctxSource && ctxSource !== source) ||
    (ctxTarget && ctxTarget !== target)
  ) {
    return {
      ok: false,
      error: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
      reliability: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
    };
  }

  const effectiveMs = new Date(effectiveAt).getTime();
  const calcMs = new Date(calculationDate || now || Date.now()).getTime();
  if (!Number.isFinite(effectiveMs) || !Number.isFinite(calcMs)) {
    return {
      ok: false,
      error: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
      reliability: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
    };
  }
  if (Math.abs(calcMs - effectiveMs) > staleMs || fxContext.stale === true) {
    return {
      ok: false,
      error: CRM_FX_RELIABILITY.STALE,
      reliability: CRM_FX_RELIABILITY.STALE,
    };
  }

  return {
    ok: true,
    reliability: CRM_FX_RELIABILITY.OK,
    rate,
    converted: true,
    snapshot: Object.freeze({
      sourceCurrency: source,
      targetCurrency: target,
      rate,
      namedSource: String(namedSource),
      effectiveAt: new Date(effectiveAt).toISOString(),
      approved: fxContext.approved === true,
    }),
  };
}

/**
 * Gate multi-currency line sets: without FX for each foreign currency, fail closed.
 */
export function assertCurrencyPricingGate({
  documentCurrency,
  lineCurrencies,
  fxContext,
  calculationDate,
  now,
} = {}) {
  const doc = documentCurrency ? String(documentCurrency).trim().toUpperCase() : null;
  const currencies = Array.isArray(lineCurrencies) ? lineCurrencies : [];
  const unique = [...new Set(currencies.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];

  if (unique.length > 1 && !fxContext) {
    // Mixed currencies without FX — never silently sum
    return {
      ok: false,
      error: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
      reliability: CRM_FX_RELIABILITY.FX_CONTEXT_MISSING,
      reason: 'currency_mix_requires_explicit_fx',
    };
  }

  for (const c of unique) {
    if (!doc || c === doc) continue;
    const resolved = resolveFxContext({
      sourceCurrency: c,
      targetCurrency: doc,
      fxContext,
      calculationDate,
      now,
    });
    if (!resolved.ok) return resolved;
  }

  return { ok: true, reliability: CRM_FX_RELIABILITY.OK };
}

export function convertAmount(amount, rate) {
  return roundMoney(Number(amount) * Number(rate));
}

export function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
