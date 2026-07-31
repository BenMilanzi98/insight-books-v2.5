/**
 * Opportunity expected close date — Phase 12 Wave 2.
 * Source + confidence + immutable history. No silent invent.
 * UNKNOWN confidence ≠ forecast-eligible for metrics.
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { hasCrmOpportunityModel, serializeOpportunity } from './model.js';

export const CRM_CLOSE_DATE_SOURCE = Object.freeze({
  REP_ESTIMATE: 'REP_ESTIMATE',
  STAGE_RULE: 'STAGE_RULE',
  IMPORT: 'IMPORT',
  CUSTOMER_STATED: 'CUSTOMER_STATED',
  UNKNOWN: 'UNKNOWN',
});

export const CRM_CLOSE_DATE_SOURCES = Object.freeze(
  Object.values(CRM_CLOSE_DATE_SOURCE)
);

export const CRM_CLOSE_DATE_CONFIDENCE = Object.freeze({
  CUSTOMER_CONFIRMED: 'CUSTOMER_CONFIRMED',
  PROCUREMENT_CONFIRMED: 'PROCUREMENT_CONFIRMED',
  INTERNALLY_ESTIMATED: 'INTERNALLY_ESTIMATED',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  UNKNOWN: 'UNKNOWN',
});

export const CRM_CLOSE_DATE_CONFIDENCES = Object.freeze(
  Object.values(CRM_CLOSE_DATE_CONFIDENCE)
);

export function hasCrmOpportunityCloseDateHistoryModel(prisma) {
  return typeof prisma?.crmOpportunityCloseDateHistory?.create === 'function';
}

/**
 * UNKNOWN confidence is never treated as a forecast date for metrics.
 */
export function isCloseDateForecastEligible(confidence) {
  const c = String(confidence || '').trim().toUpperCase();
  return Boolean(c) && c !== CRM_CLOSE_DATE_CONFIDENCE.UNKNOWN;
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

function parseCloseDate(value) {
  if (value == null || value === '') return { ok: false, error: 'expectedCloseDate_required' };
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: 'expectedCloseDate_invalid' };
  }
  return { ok: true, date: d };
}

/**
 * Set expected close date with mandatory source + confidence.
 */
export async function setOpportunityCloseDate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
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

  const parsed = parseCloseDate(args.expectedCloseDate);
  if (!parsed.ok) return parsed;

  const source = String(args.source || '').trim().toUpperCase();
  if (!CRM_CLOSE_DATE_SOURCES.includes(source)) {
    return { ok: false, error: 'close_date_source_required', allowed: CRM_CLOSE_DATE_SOURCES };
  }

  const confidence = String(args.confidence || '').trim().toUpperCase();
  if (!CRM_CLOSE_DATE_CONFIDENCES.includes(confidence)) {
    return {
      ok: false,
      error: 'close_date_confidence_required',
      allowed: CRM_CLOSE_DATE_CONFIDENCES,
    };
  }

  const now = args.now || new Date();
  const previousDate = opp.expectedCloseDate || null;
  const previousSource = opp.closeDateSource || null;
  const previousConfidence = opp.closeDateConfidence || null;

  const updated = await prisma.crmOpportunity.update({
    where: { id: opp.id },
    data: {
      expectedCloseDate: parsed.date,
      closeDateSource: source,
      closeDateConfidence: confidence,
      updatedAt: now,
    },
  });

  let historyId = null;
  if (hasCrmOpportunityCloseDateHistoryModel(prisma)) {
    const hist = await prisma.crmOpportunityCloseDateHistory.create({
      data: {
        opportunityId: opp.id,
        expectedCloseDate: parsed.date,
        source,
        confidence,
        previousExpectedCloseDate: previousDate,
        previousSource,
        previousConfidence,
        changedByAdminId: args.admin?.id || null,
        reason: args.reason != null ? String(args.reason) : null,
        at: now,
        forecastEligible: isCloseDateForecastEligible(confidence),
      },
    });
    historyId = hist?.id || null;
  }

  const forecastEligible = isCloseDateForecastEligible(confidence);

  return {
    ok: true,
    opportunity: serializeOpportunity(updated),
    historyId,
    expectedCloseDate: parsed.date.toISOString(),
    source,
    confidence,
    forecastEligible,
    /** Honesty: UNKNOWN ≠ forecast date for metrics */
    invented: false,
  };
}

export async function getOpportunityCloseDate(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden' };
  }
  if (!hasCrmOpportunityModel(prisma)) {
    return { ok: false, error: 'crm_opportunity_model_unavailable', status: 'UNAVAILABLE' };
  }

  const opp = await loadOpportunity(prisma, args.opportunityId);
  if (!opp) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  let history = [];
  if (hasCrmOpportunityCloseDateHistoryModel(prisma)) {
    try {
      history = await prisma.crmOpportunityCloseDateHistory.findMany({
        where: { opportunityId: opp.id },
        orderBy: { at: 'asc' },
      });
    } catch {
      history = [];
    }
  }

  const confidence = opp.closeDateConfidence || null;
  const forecastEligible = isCloseDateForecastEligible(confidence);

  return {
    ok: true,
    closeDate: {
      expectedCloseDate: opp.expectedCloseDate
        ? new Date(opp.expectedCloseDate).toISOString()
        : null,
      source: opp.closeDateSource || null,
      confidence,
      forecastEligible,
      invented: false,
    },
    history: (history || []).map((h) => ({
      id: h.id,
      expectedCloseDate: h.expectedCloseDate
        ? new Date(h.expectedCloseDate).toISOString()
        : null,
      source: h.source,
      confidence: h.confidence,
      previousExpectedCloseDate: h.previousExpectedCloseDate
        ? new Date(h.previousExpectedCloseDate).toISOString()
        : null,
      previousSource: h.previousSource || null,
      previousConfidence: h.previousConfidence || null,
      reason: h.reason || null,
      changedByAdminId: h.changedByAdminId || null,
      forecastEligible: Boolean(h.forecastEligible),
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
  };
}
