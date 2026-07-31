/**
 * Opportunity probability — Phase 12 Wave 2.
 * Stage default + manual override + reason + optional approval stub + confidence + history.
 * Not ML. Never label as Revenue certainty. Distinct from Lead fit score.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { getStageDefinition } from '../pipeline/stages.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

export const CRM_PROBABILITY_SOURCE = Object.freeze({
  STAGE_DEFAULT: 'STAGE_DEFAULT',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
});

export const CRM_PROBABILITY_CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNKNOWN: 'UNKNOWN',
});

export const CRM_PROBABILITY_CONFIDENCES = Object.freeze(
  Object.values(CRM_PROBABILITY_CONFIDENCE)
);

export const CRM_PROBABILITY_APPROVAL_STATUS = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export function hasCrmOpportunityProbabilityHistoryModel(prisma) {
  return typeof prisma?.crmOpportunityProbabilityHistory?.create === 'function';
}

function clampProbability(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > 100) return null;
  return v;
}

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Stage catalogue default probability (explainable; not ML).
 */
export function getStageDefaultProbability(stageCode, pipelineCode) {
  const stage = getStageDefinition(stageCode, { pipelineCode });
  if (!stage || stage.defaultProbability == null) return null;
  return clampProbability(stage.defaultProbability);
}

/**
 * Apply stage default when Opportunity is not under MANUAL_OVERRIDE.
 * Called from stage transition.
 */
export async function applyStageDefaultProbability(prisma, args = {}) {
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, skipped: true, reason: 'model_unavailable' };
  }
  const opp = args.opportunity || (await loadOpportunity(prisma, args.opportunityId));
  if (!opp) return { ok: false, error: 'opportunity_not_found' };

  if (opp.probabilitySource === CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE) {
    return {
      ok: true,
      skipped: true,
      reason: 'manual_override_preserved',
      probability: opp.probability ?? null,
      source: CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE,
      isMl: false,
      isRevenueCertainty: false,
    };
  }

  const stageCode = args.stageCode || opp.stageCode;
  const def = getStageDefaultProbability(stageCode, opp.pipelineCode);
  if (def == null) {
    return { ok: true, skipped: true, reason: 'no_stage_default' };
  }

  const now = args.now || new Date();
  const previous = opp.probability ?? null;

  const updated = await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: {
      probability: def,
      probabilitySource: CRM_PROBABILITY_SOURCE.STAGE_DEFAULT,
      probabilityConfidence:
        opp.probabilityConfidence || CRM_PROBABILITY_CONFIDENCE.MEDIUM,
      probabilityOverrideReason: null,
      updatedAt: now,
    },
  });

  let historyId = null;
  if (hasCrmOpportunityProbabilityHistoryModel(prisma)) {
    const hist = await prisma.crmOpportunityProbabilityHistory.create({
      data: {
        opportunityId: opp.id,
        probability: def,
        source: CRM_PROBABILITY_SOURCE.STAGE_DEFAULT,
        confidence:
          updated.probabilityConfidence || CRM_PROBABILITY_CONFIDENCE.MEDIUM,
        previousProbability: previous,
        stageCode,
        reason: args.reason || `stage_default:${stageCode}`,
        approvalStatus: CRM_PROBABILITY_APPROVAL_STATUS.NOT_REQUIRED,
        changedByAdminId: args.admin?.id || null,
        at: now,
        isMl: false,
        isRevenueCertainty: false,
      },
    });
    historyId = hist?.id || null;
  }

  return {
    ok: true,
    skipped: false,
    opportunity: serializeOpportunity(updated),
    historyId,
    probability: def,
    source: CRM_PROBABILITY_SOURCE.STAGE_DEFAULT,
    isMl: false,
    isRevenueCertainty: false,
  };
}

/**
 * Manual probability override — requires edit permission + reason.
 * Optional approval stub; not ML; not Revenue certainty.
 */
export async function overrideOpportunityProbability(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canOverrideOpportunityProbability) {
    return { ok: false, forbidden: true, reason: 'crm_probability_override_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const probability = clampProbability(args.probability);
  if (probability == null) {
    return { ok: false, error: 'probability_must_be_0_to_100' };
  }

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) {
    return { ok: false, error: 'override_reason_required' };
  }

  let confidence = String(args.confidence || CRM_PROBABILITY_CONFIDENCE.MEDIUM)
    .trim()
    .toUpperCase();
  if (!CRM_PROBABILITY_CONFIDENCES.includes(confidence)) {
    return {
      ok: false,
      error: 'invalid_confidence',
      allowed: CRM_PROBABILITY_CONFIDENCES,
    };
  }

  let approvalStatus = CRM_PROBABILITY_APPROVAL_STATUS.NOT_REQUIRED;
  if (args.approvalStatus != null) {
    const a = String(args.approvalStatus).trim().toUpperCase();
    if (!Object.values(CRM_PROBABILITY_APPROVAL_STATUS).includes(a)) {
      return { ok: false, error: 'invalid_approval_status' };
    }
    approvalStatus = a;
  } else if (args.requireApproval) {
    approvalStatus = CRM_PROBABILITY_APPROVAL_STATUS.PENDING;
  }

  const now = args.now || new Date();
  const previous = opp.probability ?? null;

  const updated = await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: {
      probability,
      probabilitySource: CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE,
      probabilityConfidence: confidence,
      probabilityOverrideReason: reason,
      updatedAt: now,
    },
  });

  let historyId = null;
  if (hasCrmOpportunityProbabilityHistoryModel(prisma)) {
    const hist = await prisma.crmOpportunityProbabilityHistory.create({
      data: {
        opportunityId: opp.id,
        probability,
        source: CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE,
        confidence,
        previousProbability: previous,
        stageCode: opp.stageCode,
        reason,
        approvalStatus,
        changedByAdminId: args.admin?.id || null,
        at: now,
        isMl: false,
        isRevenueCertainty: false,
      },
    });
    historyId = hist?.id || null;
  }

  return {
    ok: true,
    opportunity: serializeOpportunity(updated),
    historyId,
    probability,
    source: CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE,
    confidence,
    approvalStatus,
    approvalStub: {
      status: approvalStatus,
      required: approvalStatus !== CRM_PROBABILITY_APPROVAL_STATUS.NOT_REQUIRED,
    },
    isMl: false,
    isRevenueCertainty: false,
    isLeadFitScore: false,
  };
}

export async function getOpportunityProbability(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const stageDefault = getStageDefaultProbability(opp.stageCode, opp.pipelineCode);

  let history = [];
  if (hasCrmOpportunityProbabilityHistoryModel(prisma)) {
    try {
      history = await prisma.crmOpportunityProbabilityHistory.findMany({
        where: { opportunityId: opp.id },
        orderBy: { at: 'asc' },
      });
    } catch {
      history = [];
    }
  }

  return {
    ok: true,
    probability: {
      value: opp.probability ?? null,
      source: opp.probabilitySource || null,
      confidence: opp.probabilityConfidence || null,
      overrideReason: opp.probabilityOverrideReason || null,
      stageDefault,
      isMl: false,
      isRevenueCertainty: false,
      isLeadFitScore: false,
    },
    history: (history || []).map((h) => ({
      id: h.id,
      probability: h.probability,
      source: h.source,
      confidence: h.confidence,
      previousProbability: h.previousProbability ?? null,
      stageCode: h.stageCode || null,
      reason: h.reason || null,
      approvalStatus: h.approvalStatus || null,
      changedByAdminId: h.changedByAdminId || null,
      at: h.at ? new Date(h.at).toISOString() : null,
      isMl: false,
      isRevenueCertainty: false,
    })),
  };
}
