/**
 * In-platform commercial tax context — Phase 15 Wave 2.
 * Overrides require approval. No Tenant GL tax posting. No MRA EIS fiscal.
 */

import { roundMoney } from './currencyFx.js';

/**
 * Resolve effective tax rate from taxContext.
 * Override without approval → fail.
 */
export function resolveTaxContext(taxContext = {}) {
  const ctx = taxContext && typeof taxContext === 'object' ? taxContext : {};
  const baseRate = Number(ctx.ratePercent);
  const hasOverride =
    ctx.overrideRatePercent != null && ctx.overrideRatePercent !== '' && ctx.overrideRatePercent !== undefined;

  if (hasOverride) {
    const overrideRate = Number(ctx.overrideRatePercent);
    if (!Number.isFinite(overrideRate)) {
      return { ok: false, error: 'tax_override_invalid' };
    }
    if (ctx.overrideApproved !== true) {
      return {
        ok: false,
        error: 'tax_override_requires_approval',
        reason: 'Tax rate overrides require approved evidence',
      };
    }
    return {
      ok: true,
      ratePercent: overrideRate,
      inclusive: ctx.inclusive === true,
      jurisdiction: ctx.jurisdiction || null,
      overridden: true,
      tenantGlPosting: false,
      mraEisFiscal: false,
    };
  }

  return {
    ok: true,
    ratePercent: Number.isFinite(baseRate) ? baseRate : 0,
    inclusive: ctx.inclusive === true,
    jurisdiction: ctx.jurisdiction || null,
    overridden: false,
    tenantGlPosting: false,
    mraEisFiscal: false,
  };
}

export function computeTaxTotal(netSubtotal, taxResolved) {
  const net = Number(netSubtotal) || 0;
  const rate = Number(taxResolved?.ratePercent) || 0;
  if (taxResolved?.inclusive) {
    // net already includes tax — extract tax portion
    const tax = roundMoney(net - net / (1 + rate / 100));
    return { taxTotal: tax, taxBase: roundMoney(net - tax) };
  }
  return { taxTotal: roundMoney((net * rate) / 100), taxBase: net };
}
