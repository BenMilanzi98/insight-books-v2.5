/**
 * Dimension scorers barrel + N/A stubs for uninstrumented dims.
 */

import { DIMENSION_CODES, DIMENSION_STATUS, V1_NA_DIMENSIONS } from '../catalogue.js';
import { scoreCommercialDimension } from './commercial.js';
import { scoreEngagementDimension } from './engagement.js';
import { scoreMraEisDimension } from './mraEis.js';
import { scoreRelationshipDimension } from './relationship.js';

/**
 * Explicit NOT_APPLICABLE stub — score is null (never 0).
 * @param {string} code
 * @param {string} [reason]
 */
export function notApplicableDimension(code, reason = 'NOT_INSTRUMENTED') {
  return {
    code,
    status: DIMENSION_STATUS.NOT_APPLICABLE,
    score: null,
    baseWeight: 0,
    effectiveWeight: 0,
    drivers: [
      {
        code: 'not_instrumented',
        impact: 0,
        detail: reason,
      },
    ],
    reason,
  };
}

/**
 * Evaluate all v1 dimensions for a tenant.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {object} [ctx]
 */
export async function evaluateAllDimensions(prisma, tenantId, ctx = {}) {
  const weights = ctx.weights || {};
  const [commercial, engagement, mraEis, relationship] = await Promise.all([
    scoreCommercialDimension(prisma, tenantId, {
      now: ctx.now,
      currency: ctx.currency,
      commercial: ctx.commercial,
      tenantStatus: ctx.tenantStatus,
      baseWeight: weights[DIMENSION_CODES.COMMERCIAL],
    }),
    scoreEngagementDimension(prisma, tenantId, {
      now: ctx.now,
      engagement: ctx.engagement,
      baseWeight: weights[DIMENSION_CODES.ENGAGEMENT],
    }),
    scoreMraEisDimension(prisma, tenantId, {
      now: ctx.now,
      subscriptions: ctx.subscriptions,
      mraEis: ctx.mraEis,
      baseWeight: weights[DIMENSION_CODES.MRA_EIS],
    }),
    scoreRelationshipDimension(prisma, tenantId, {
      now: ctx.now,
      baseWeight: weights[DIMENSION_CODES.RELATIONSHIP],
    }),
  ]);

  const naDims = V1_NA_DIMENSIONS.map((code) =>
    notApplicableDimension(
      code,
      code === DIMENSION_CODES.ADOPTION
        ? 'FEATURE_USED not instrumented — never score as 0'
        : 'Source not instrumented for v1 health'
    )
  );

  return [commercial, engagement, mraEis, relationship, ...naDims];
}

export {
  scoreCommercialDimension,
  scoreEngagementDimension,
  scoreMraEisDimension,
  scoreRelationshipDimension,
};
