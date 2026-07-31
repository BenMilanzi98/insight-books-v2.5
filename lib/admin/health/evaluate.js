/**
 * Customer Health evaluation engine.
 * EXCLUDE_AND_RENORMALISE; never score missing as 0; confidence separate from score.
 */

import { loadTenantCommercial } from '@/lib/admin/customers/commercial.js';
import {
  DIMENSION_STATUS,
  HEALTH_BANDS,
  HEALTH_CATALOGUE_NOTES,
  HEALTH_CONFIDENCE,
  MIN_SCORED_DIMENSIONS,
  MISSING_POLICY,
  V1_BASE_WEIGHTS,
} from './catalogue.js';
import { resolveHealthAccess, assertHealthTenantAccess } from './authz.js';
import { getActiveHealthDefinition, bandForScore } from './definitions.js';
import { evaluateAllDimensions } from './dimensions/index.js';
import { resolveHealthConfidence } from './confidence.js';
import { applyHealthOverrides } from './overrides.js';

/**
 * Renormalise weights among SCORED dimensions (EXCLUDE_AND_RENORMALISE).
 * @param {object[]} dimensions
 * @param {string} missingPolicy
 */
export function applyMissingPolicy(dimensions, missingPolicy) {
  const policy = missingPolicy || MISSING_POLICY.EXCLUDE_AND_RENORMALISE;
  const next = dimensions.map((d) => ({
    ...d,
    effectiveWeight: 0,
  }));

  if (policy !== MISSING_POLICY.EXCLUDE_AND_RENORMALISE) {
    return { dimensions: next, weightSum: 0 };
  }

  const scored = next.filter((d) => d.status === DIMENSION_STATUS.SCORED);
  const baseSum = scored.reduce((a, d) => a + Number(d.baseWeight || 0), 0);

  if (baseSum <= 0) {
    return { dimensions: next, weightSum: 0 };
  }

  for (const d of scored) {
    d.effectiveWeight = Number(d.baseWeight || 0) / baseSum;
  }

  return {
    dimensions: next,
    weightSum: scored.reduce((a, d) => a + d.effectiveWeight, 0),
  };
}

/**
 * Weighted score from SCORED dims only.
 * @param {object[]} dimensions
 * @returns {number|null}
 */
export function computeWeightedScore(dimensions) {
  const scored = (dimensions || []).filter(
    (d) => d.status === DIMENSION_STATUS.SCORED && d.score != null
  );
  if (scored.length < MIN_SCORED_DIMENSIONS) return null;
  let total = 0;
  for (const d of scored) {
    total += Number(d.score) * Number(d.effectiveWeight || 0);
  }
  return Math.round(Math.max(0, Math.min(100, total)) * 10) / 10;
}

function collectDrivers(dimensions, limit = 8) {
  const rows = [];
  for (const d of dimensions || []) {
    if (d.status !== DIMENSION_STATUS.SCORED) continue;
    for (const dr of d.drivers || []) {
      rows.push({
        dimension: d.code,
        ...dr,
      });
    }
  }
  rows.sort((a, b) => Math.abs(b.impact || 0) - Math.abs(a.impact || 0));
  return rows.slice(0, limit);
}

function collectMissing(dimensions) {
  return (dimensions || [])
    .filter(
      (d) =>
        d.status === DIMENSION_STATUS.NOT_APPLICABLE ||
        d.status === DIMENSION_STATUS.UNAVAILABLE ||
        d.status === DIMENSION_STATUS.FAILED
    )
    .map((d) => ({
      code: d.code,
      status: d.status,
      reason: d.reason || null,
    }));
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   asOf?: Date|string,
 *   definitionVersion?: string,
 *   currency?: string,
 * }} opts
 */
export async function evaluateCustomerHealth(prisma, opts = {}) {
  const admin = opts.admin;
  const tenantId = opts.tenantId ? String(opts.tenantId) : '';
  const now = opts.asOf
    ? new Date(opts.asOf)
    : opts.now
      ? new Date(opts.now)
      : new Date();
  const currency = opts.currency || 'MWK';

  const access = resolveHealthAccess(admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      reason: 'health_forbidden',
      notes: HEALTH_CATALOGUE_NOTES,
    };
  }

  if (!tenantId) {
    return {
      ok: false,
      error: 'tenantId required',
      notes: HEALTH_CATALOGUE_NOTES,
    };
  }

  const scopeGate = await assertHealthTenantAccess(prisma, admin, tenantId, { now });
  if (!scopeGate.ok) {
    return {
      ok: false,
      forbidden: true,
      reason: scopeGate.reason || 'out_of_portfolio_scope',
      notes: HEALTH_CATALOGUE_NOTES,
    };
  }

  let tenant = null;
  try {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: e?.message || 'Tenant lookup failed',
      notes: HEALTH_CATALOGUE_NOTES,
    };
  }

  if (!tenant) {
    return {
      ok: false,
      notFound: true,
      error: 'Customer not found',
      notes: HEALTH_CATALOGUE_NOTES,
    };
  }

  const definition = await getActiveHealthDefinition(prisma, {
    definitionVersion: opts.definitionVersion,
  });

  let commercial = null;
  try {
    commercial = await loadTenantCommercial(prisma, tenantId, { now, currency });
  } catch {
    commercial = { ok: false, reasonCode: 'query_failed', message: 'Commercial load failed' };
  }

  const subscriptions = commercial?.ok ? commercial.subscriptions || [] : [];
  const subscriptionStatus =
    commercial?.ok
      ? commercial.activeSubscription?.status || commercial.subscriptionStatus
      : null;

  let dimensions = await evaluateAllDimensions(prisma, tenantId, {
    now,
    currency,
    commercial,
    subscriptions,
    tenantStatus: tenant.status,
    weights: definition.weights || V1_BASE_WEIGHTS,
  });

  // Ensure baseWeight from definition for v1 dims
  dimensions = dimensions.map((d) => {
    if (definition.weights?.[d.code] != null) {
      return { ...d, baseWeight: definition.weights[d.code] };
    }
    return d;
  });

  const { dimensions: renormalised, weightSum } = applyMissingPolicy(
    dimensions,
    definition.missingPolicy
  );
  dimensions = renormalised;

  const scoredCount = dimensions.filter((d) => d.status === DIMENSION_STATUS.SCORED).length;
  const minScored = definition.minScoredDimensions ?? MIN_SCORED_DIMENSIONS;

  let score = null;
  let band = HEALTH_BANDS.UNKNOWN;
  let confidenceResult = resolveHealthConfidence(dimensions, { minScored });

  if (scoredCount >= minScored) {
    score = computeWeightedScore(dimensions);
    band = bandForScore(score, definition.bands);
  } else {
    score = null;
    band = HEALTH_BANDS.UNKNOWN;
    confidenceResult = {
      confidence: HEALTH_CONFIDENCE.INSUFFICIENT,
      reasons: [
        `Fewer than ${minScored} SCORED dimensions (${scoredCount})`,
        ...(confidenceResult.reasons || []),
      ],
    };
  }

  const overrideResult = applyHealthOverrides({
    band,
    score,
    dimensions,
    tenantStatus: tenant.status,
    subscriptionStatus,
    definition,
  });
  band = overrideResult.band;

  // Overrides do not invent score when evidence is insufficient — but critical
  // forceBand overrides (e.g. SUSPENDED) must keep CRITICAL even if score is null.
  if (score == null) {
    const hasForceBandOverride = (overrideResult.overrides || []).some((o) =>
      String(o.effect || '').startsWith('forceBand=')
    );
    if (!hasForceBandOverride) {
      band = HEALTH_BANDS.UNKNOWN;
    }
  }

  const drivers = collectDrivers(dimensions);
  const missing = collectMissing(dimensions);

  return {
    ok: true,
    tenantId: tenant.id,
    customer: {
      tenantId: tenant.id,
      displayName: tenant.name,
      customerReference: tenant.subdomain,
      status: tenant.status,
    },
    definitionVersion: definition.version,
    missingPolicy: definition.missingPolicy,
    asOf: now.toISOString(),
    score,
    band,
    confidence: confidenceResult.confidence,
    confidenceReasons: confidenceResult.reasons,
    dimensions,
    drivers,
    missing,
    overrides: overrideResult.overrides,
    weightSum,
    notes: HEALTH_CATALOGUE_NOTES,
    disclaimer:
      'Health score is explainable commercial/engagement/EIS/relationship evidence — not churn or renewal probability.',
  };
}
