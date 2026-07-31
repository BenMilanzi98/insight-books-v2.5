/**
 * Deterministic CRM lead scoring engine — Phase 11 Wave 3.
 * Same inputs → same score. Missing data lowers confidence — does not invent values.
 * Critical caps (DNC / SPAM / compliance) override positive engagement.
 * Historical evaluations are append-only / immutable.
 */

import {
  CRM_SCORE_BAND,
  CRM_SCORE_CONFIDENCE,
  CRM_SCORE_FORBIDDEN_LABELS,
} from './catalogue.js';
import {
  getActiveScoreDefinition,
  getScoreDefinitionByVersion,
} from './definitions.js';
import { resolveCrmAccess } from '../authz.js';
import { hasCrmLeadModel, serializeLead } from '../leads.js';
import { CRM_LEAD_STATUS } from '../catalogue.js';

export function hasCrmScoreEvaluationModel(prisma) {
  return typeof prisma?.crmScoreEvaluation?.create === 'function';
}

export function hasCrmScoreContributionModel(prisma) {
  return typeof prisma?.crmScoreContribution?.create === 'function';
}

/**
 * Guard: reject forbidden probability/revenue wording in caller labels.
 * @param {string|null|undefined} label
 */
export function assertScoreLabelSafe(label) {
  if (label == null || label === '') return { ok: true };
  const lower = String(label).toLowerCase();
  for (const forbidden of CRM_SCORE_FORBIDDEN_LABELS) {
    if (lower.includes(forbidden)) {
      return { ok: false, error: 'forbidden_score_label', forbidden };
    }
  }
  return { ok: true };
}

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function bandForScore(bands, score, forcedBand) {
  if (forcedBand) return forcedBand;
  const list = Array.isArray(bands) ? bands : [];
  for (const b of list) {
    if (score >= Number(b.min) && score <= Number(b.max)) return b.band;
  }
  if (score >= 70) return CRM_SCORE_BAND.HOT;
  if (score >= 40) return CRM_SCORE_BAND.WARM;
  return CRM_SCORE_BAND.COLD;
}

function confidenceFromMissing(missingCount, total) {
  if (total <= 0) return CRM_SCORE_CONFIDENCE.INSUFFICIENT;
  if (missingCount <= 0) return CRM_SCORE_CONFIDENCE.HIGH;
  const ratio = missingCount / total;
  if (ratio >= 0.75) return CRM_SCORE_CONFIDENCE.INSUFFICIENT;
  if (ratio >= 0.4) return CRM_SCORE_CONFIDENCE.LOW;
  return CRM_SCORE_CONFIDENCE.MEDIUM;
}

/**
 * Pure deterministic evaluation.
 *
 * @param {object} definition
 * @param {{
 *   dimensionScores?: Record<string, number|null|undefined>,
 *   flags?: string[],
 * }} inputs
 */
export function computeScore(definition, inputs = {}) {
  const dimensions = Array.isArray(definition?.dimensions) ? definition.dimensions : [];
  const caps = Array.isArray(definition?.criticalCaps) ? definition.criticalCaps : [];
  const flags = new Set((inputs.flags || []).map((f) => String(f).toUpperCase()));
  const dimScores = inputs.dimensionScores || {};

  const contributions = [];
  let rawTotal = 0;
  let missingCount = 0;

  for (const dim of dimensions) {
    const key = String(dim.key).toUpperCase();
    const maxPoints = Number(dim.maxPoints ?? dim.weight) || 0;
    const raw = dimScores[key] ?? dimScores[dim.key];
    const missing = raw == null || raw === '' || Number.isNaN(Number(raw));
    if (missing) {
      missingCount += 1;
      contributions.push({
        dimensionKey: key,
        label: dim.label || key,
        weight: Number(dim.weight) || maxPoints,
        maxPoints,
        rawValue: null,
        points: 0,
        missing: true,
      });
      continue;
    }
    const value = Math.max(0, Math.min(maxPoints, Number(raw)));
    rawTotal += value;
    contributions.push({
      dimensionKey: key,
      label: dim.label || key,
      weight: Number(dim.weight) || maxPoints,
      maxPoints,
      rawValue: value,
      points: value,
      missing: false,
    });
  }

  let score = clampScore(rawTotal);
  let capped = false;
  let capKey = null;
  let band = bandForScore(definition.bands, score, null);

  for (const cap of caps) {
    const key = String(cap.key).toUpperCase();
    if (flags.has(key)) {
      score = clampScore(Number(cap.capScore) || 0);
      capped = true;
      capKey = key;
      band = cap.band || CRM_SCORE_BAND.BLOCKED;
      break;
    }
  }

  const confidence = capped
    ? CRM_SCORE_CONFIDENCE.HIGH
    : confidenceFromMissing(missingCount, dimensions.length);

  return {
    score,
    band,
    confidence,
    capped,
    capKey,
    contributions,
    missingCount,
    dimensionCount: dimensions.length,
    displayLabel: definition.displayLabel || 'Lead fit score',
    /** Explicit contract fields — never probability */
    isProbability: false,
    isExpectedRevenue: false,
  };
}

function serializeEvaluation(row, contributions = []) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    definitionVersionId: row.definitionVersionId,
    score: row.score,
    band: row.band,
    confidence: row.confidence,
    capped: Boolean(row.capped),
    capKey: row.capKey || null,
    displayLabel: row.displayLabel || 'Lead fit score',
    isProbability: false,
    isExpectedRevenue: false,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    contributions: (contributions || []).map((c) => ({
      dimensionKey: c.dimensionKey,
      label: c.label || null,
      weight: c.weight,
      maxPoints: c.maxPoints,
      rawValue: c.rawValue,
      points: c.points,
      missing: Boolean(c.missing),
    })),
  };
}

async function resolveLeadFlags(prisma, lead) {
  const flags = [];
  if (!lead) return flags;
  if (lead.status === CRM_LEAD_STATUS.SPAM) flags.push('SPAM');

  if (lead.contactId && typeof prisma?.crmDoNotContact?.findMany === 'function') {
    try {
      const dnc = await prisma.crmDoNotContact.findMany({
        where: { contactId: lead.contactId, active: true },
      });
      if ((dnc || []).some((r) => r.flag === 'DO_NOT_CONTACT_ALL')) {
        flags.push('DO_NOT_CONTACT');
      }
    } catch {
      // ignore
    }
  }
  return flags;
}

/**
 * Run score for a lead; persists immutable evaluation + contributions.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   leadId: string,
 *   definitionVersionId?: string|null,
 *   dimensionScores?: Record<string, number|null>,
 *   flags?: string[],
 *   label?: string|null,
 *   now?: Date,
 * }} args
 */
export async function runLeadScore(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canScoreLeads) {
    return { ok: false, forbidden: true, reason: 'crm_score_forbidden' };
  }

  const labelGate = assertScoreLabelSafe(args.label);
  if (!labelGate.ok) return labelGate;

  if (!hasCrmLeadModel(prisma)) {
    return { ok: false, error: 'crm_lead_model_unavailable', status: 'UNAVAILABLE' };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId_required' };

  let lead = null;
  try {
    lead = await prisma.crmLead.findUnique({ where: { id: leadId } });
  } catch {
    lead = null;
  }
  if (!lead) return { ok: false, notFound: true, error: 'lead_not_found' };

  let definition = null;
  if (args.definitionVersionId) {
    definition = await getScoreDefinitionByVersion(prisma, args.definitionVersionId);
    if (!definition) {
      return { ok: false, error: 'DEFINITION_MISSING', definitionVersionId: args.definitionVersionId };
    }
  } else {
    definition = await getActiveScoreDefinition(prisma);
  }

  const autoFlags = await resolveLeadFlags(prisma, lead);
  const flags = [...new Set([...(args.flags || []), ...autoFlags].map((f) => String(f).toUpperCase()))];

  const result = computeScore(definition, {
    dimensionScores: args.dimensionScores || {},
    flags,
  });

  const now = args.now || new Date();
  let evaluationRow = null;
  let contributionRows = [];

  if (hasCrmScoreEvaluationModel(prisma)) {
    try {
      evaluationRow = await prisma.crmScoreEvaluation.create({
        data: {
          leadId: lead.id,
          definitionVersionId: definition.versionId,
          score: result.score,
          band: result.band,
          confidence: result.confidence,
          capped: result.capped,
          capKey: result.capKey,
          displayLabel: result.displayLabel,
          createdByAdminId: args.admin?.id || null,
          createdAt: now,
        },
      });

      if (hasCrmScoreContributionModel(prisma)) {
        for (const c of result.contributions) {
          try {
            const row = await prisma.crmScoreContribution.create({
              data: {
                evaluationId: evaluationRow.id,
                dimensionKey: c.dimensionKey,
                label: c.label,
                weight: c.weight,
                maxPoints: c.maxPoints,
                rawValue: c.rawValue,
                points: c.points,
                missing: c.missing,
              },
            });
            contributionRows.push(row);
          } catch {
            contributionRows.push(c);
          }
        }
      } else {
        contributionRows = result.contributions;
      }
    } catch {
      // Persist soft-fail (e.g. catalogue version not yet seeded in DB)
      contributionRows = result.contributions;
    }
  }

  return {
    ok: true,
    evaluation: serializeEvaluation(
      evaluationRow || {
        id: null,
        leadId: lead.id,
        definitionVersionId: definition.versionId,
        score: result.score,
        band: result.band,
        confidence: result.confidence,
        capped: result.capped,
        capKey: result.capKey,
        displayLabel: result.displayLabel,
        createdAt: now,
      },
      contributionRows.length ? contributionRows : result.contributions
    ),
    lead: serializeLead(lead),
    definitionVersionId: definition.versionId,
    immutable: true,
  };
}

/**
 * Latest persisted score evaluation + dimension contributions for explainability UI.
 * Never invents a score — returns insufficient/unavailable when none exists.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, leadId: string }} args
 */
export async function getLatestLeadScore(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden' };
  }

  const leadId = args.leadId ? String(args.leadId).trim() : '';
  if (!leadId) return { ok: false, error: 'leadId_required' };

  if (typeof prisma?.crmScoreEvaluation?.findFirst !== 'function') {
    return {
      ok: true,
      evaluation: null,
      status: 'UNAVAILABLE',
      confidence: CRM_SCORE_CONFIDENCE.INSUFFICIENT,
      isProbability: false,
    };
  }

  let row = null;
  try {
    row = await prisma.crmScoreEvaluation.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    row = null;
  }

  if (!row) {
    return {
      ok: true,
      evaluation: null,
      status: 'INSUFFICIENT',
      confidence: CRM_SCORE_CONFIDENCE.INSUFFICIENT,
      isProbability: false,
    };
  }

  let contributions = [];
  if (typeof prisma?.crmScoreContribution?.findMany === 'function') {
    try {
      contributions = await prisma.crmScoreContribution.findMany({
        where: { evaluationId: row.id },
        orderBy: { dimensionKey: 'asc' },
      });
    } catch {
      contributions = [];
    }
  }

  return {
    ok: true,
    evaluation: serializeEvaluation(row, contributions),
    status: 'OK',
    confidence: row.confidence || CRM_SCORE_CONFIDENCE.INSUFFICIENT,
    isProbability: false,
  };
}
