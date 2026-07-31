/**
 * Critical health band overrides — keep dimension scores visible.
 */

import {
  OVERRIDE_CODES,
  HEALTH_BANDS,
  DIMENSION_CODES,
  DIMENSION_STATUS,
} from './catalogue.js';

const BAND_RANK = Object.freeze({
  [HEALTH_BANDS.HEALTHY]: 5,
  [HEALTH_BANDS.STABLE]: 4,
  [HEALTH_BANDS.NEEDS_ATTENTION]: 3,
  [HEALTH_BANDS.AT_RISK]: 2,
  [HEALTH_BANDS.CRITICAL]: 1,
  [HEALTH_BANDS.UNKNOWN]: 0,
});

/** Return the worse (more critical) of two bands. */
function worseBand(a, b) {
  const ra = BAND_RANK[a] ?? 0;
  const rb = BAND_RANK[b] ?? 0;
  return ra <= rb ? a : b;
}

function isSuspendedOrCancelled(status) {
  const s = String(status || '').toUpperCase();
  return (
    s.includes('SUSPEND') ||
    s === 'CANCELLED' ||
    s === 'CANCELED' ||
    s === 'RESTRICTED'
  );
}

/**
 * Apply critical overrides to band (score unchanged).
 *
 * @param {{
 *   band: string,
 *   score: number|null,
 *   dimensions: object[],
 *   tenantStatus?: string,
 *   subscriptionStatus?: string,
 *   definition?: object,
 * }} input
 * @returns {{ band: string, overrides: object[] }}
 */
export function applyHealthOverrides(input = {}) {
  let band = input.band || HEALTH_BANDS.UNKNOWN;
  const overrides = [];
  const defOverrides = input.definition?.overrides || {};
  const dims = input.dimensions || [];

  const commercial = dims.find((d) => d.code === DIMENSION_CODES.COMMERCIAL);
  const mraEis = dims.find((d) => d.code === DIMENSION_CODES.MRA_EIS);

  if (
    isSuspendedOrCancelled(input.tenantStatus) ||
    isSuspendedOrCancelled(input.subscriptionStatus) ||
    isSuspendedOrCancelled(commercial?.facts?.subscriptionStatus)
  ) {
    const rule = defOverrides[OVERRIDE_CODES.SUSPENDED_OR_CANCELLED] || {
      forceBand: HEALTH_BANDS.CRITICAL,
    };
    band = rule.forceBand || HEALTH_BANDS.CRITICAL;
    overrides.push({
      code: OVERRIDE_CODES.SUSPENDED_OR_CANCELLED,
      reason: 'Tenant or primary subscription SUSPENDED / CANCELLED',
      effect: `forceBand=${band}`,
      tenantStatus: input.tenantStatus || null,
      subscriptionStatus:
        input.subscriptionStatus || commercial?.facts?.subscriptionStatus || null,
    });
  }

  const outstanding = Number(commercial?.facts?.outstanding) || 0;
  const mrr = Number(commercial?.facts?.mrr) || 0;
  if (commercial?.status === DIMENSION_STATUS.SCORED && outstanding > 0) {
    const critRule = defOverrides[OVERRIDE_CODES.SEVERE_OUTSTANDING_CRITICAL] || {
      mrrMultiple: 3,
      absoluteFloor: 50000,
      forceBand: HEALTH_BANDS.CRITICAL,
    };
    const isCriticalSevere =
      (mrr > 0 && outstanding >= mrr * (critRule.mrrMultiple || 3)) ||
      outstanding >= (critRule.absoluteFloor || 50000);

    if (isCriticalSevere) {
      band = worseBand(band, critRule.forceBand || HEALTH_BANDS.CRITICAL);
      overrides.push({
        code: OVERRIDE_CODES.SEVERE_OUTSTANDING_CRITICAL,
        reason: 'Severe platform outstanding (CRITICAL threshold)',
        effect: `forceBand=${critRule.forceBand || HEALTH_BANDS.CRITICAL}`,
        outstanding,
        mrr,
      });
    } else {
      const capRule = defOverrides[OVERRIDE_CODES.SEVERE_OUTSTANDING] || {
        capBand: HEALTH_BANDS.AT_RISK,
      };
      const capBand = capRule.capBand || HEALTH_BANDS.AT_RISK;
      band = worseBand(band, capBand);
      overrides.push({
        code: OVERRIDE_CODES.SEVERE_OUTSTANDING,
        reason: 'Platform outstanding aligned with HIGH_OUTSTANDING_BALANCE',
        effect: `capBand=${capBand}`,
        outstanding,
        mrr,
      });
    }
  }

  if (
    mraEis?.facts?.eisDependent &&
    (mraEis.facts.revoked ||
      String(mraEis.facts.entitlementStatus || '').toUpperCase() === 'REVOKED')
  ) {
    const rule = defOverrides[OVERRIDE_CODES.EIS_REVOKED] || {
      forceBand: HEALTH_BANDS.CRITICAL,
    };
    band = rule.forceBand || HEALTH_BANDS.CRITICAL;
    overrides.push({
      code: OVERRIDE_CODES.EIS_REVOKED,
      reason: 'MRA EIS entitlement REVOKED when EIS-dependent',
      effect: `forceBand=${band}`,
      entitlementStatus: mraEis.facts.entitlementStatus,
    });
  }

  return { band, overrides };
}
