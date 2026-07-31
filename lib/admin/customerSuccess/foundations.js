/**
 * Onboarding / training / survey foundations — source-gated.
 * Empty → NOT_INSTRUMENTED. Never invent progress % from logins or engagement.
 * Phase 17 Wave 4: when CsOnboardingRecord.onboardingProjectId is set, project
 * CustomerOnboardingProject.status — never invent COMPLETED from historical rows.
 * Phase 18 Wave 4: when CsTrainingRecord.trainingProgramId is set, project
 * CustomerTrainingProgram.status — broken link → UNKNOWN not legacy COMPLETED.
 * Phase 19 Wave 4: when CsSuccessPlan.adoptionPlanId is set, project
 * CustomerAdoptionPlan.status — broken link → UNKNOWN not legacy COMPLETED.
 */

import { CS_FOUNDATION_KIND, CS_FOUNDATION_STATUS } from './catalogue.js';
import {
  assertCsTenantAccess,
  resolveCsAccess,
  resolveCsPortfolioScope,
  csTenantIdFilter,
} from './authz.js';

const MODEL_BY_KIND = Object.freeze({
  [CS_FOUNDATION_KIND.ONBOARDING]: 'csOnboardingRecord',
  [CS_FOUNDATION_KIND.TRAINING]: 'csTrainingRecord',
  [CS_FOUNDATION_KIND.SURVEY]: 'csSurveyResponse',
  [CS_FOUNDATION_KIND.PLANS]: 'csSuccessPlan',
});

function normalizeKind(kind) {
  const k = String(kind || '')
    .trim()
    .toLowerCase();
  if (k === 'surveys') return CS_FOUNDATION_KIND.SURVEY;
  if (k === 'survey') return CS_FOUNDATION_KIND.SURVEY;
  if (k === 'training') return CS_FOUNDATION_KIND.TRAINING;
  if (k === 'onboarding') return CS_FOUNDATION_KIND.ONBOARDING;
  if (k === 'plans' || k === 'plan' || k === 'success_plan' || k === 'success-plan') {
    return CS_FOUNDATION_KIND.PLANS;
  }
  return null;
}

function linkIdForKind(kind, row) {
  if (kind === CS_FOUNDATION_KIND.TRAINING) {
    return row.trainingProgramId || null;
  }
  if (kind === CS_FOUNDATION_KIND.ONBOARDING) {
    return row.onboardingProjectId || null;
  }
  if (kind === CS_FOUNDATION_KIND.PLANS) {
    return row.adoptionPlanId || null;
  }
  return null;
}

function serializeRow(kind, row, linkedEntity = null) {
  if (!row) return null;
  const linkId = linkIdForKind(kind, row);
  const hasLink = Boolean(linkId);
  const linked = Boolean(hasLink && linkedEntity);
  // Orphan / unresolved link — never invent COMPLETED from legacy row.status
  const linkBroken = hasLink && !linkedEntity;

  let status;
  if (linked) {
    status = linkedEntity.status || null;
  } else if (linkBroken) {
    const mig = String(row.migrationStatus || '').toUpperCase();
    status =
      mig === 'UNKNOWN' || mig === 'NOT_INSTRUMENTED' || mig === 'LINK_BROKEN'
        ? mig
        : 'UNKNOWN';
  } else {
    status = row.status || null;
  }

  const isTraining = kind === CS_FOUNDATION_KIND.TRAINING;
  const isPlans = kind === CS_FOUNDATION_KIND.PLANS;
  const isOnboarding = kind === CS_FOUNDATION_KIND.ONBOARDING;

  return {
    id: row.id,
    tenantId: row.tenantId,
    kind,
    checklistKey:
      row.checklistKey || row.moduleKey || row.surveyKey || row.title || null,
    status,
    completedAt:
      linked || linkBroken
        ? null
        : row.completedAt
          ? new Date(row.completedAt).toISOString()
          : null,
    sourceNote: row.sourceNote || null,
    score: row.score != null ? row.score : null,
    onboardingProjectId: row.onboardingProjectId || null,
    trainingProgramId: row.trainingProgramId || null,
    adoptionPlanId: row.adoptionPlanId || null,
    migrationStatus: linkBroken
      ? row.migrationStatus || 'UNKNOWN'
      : row.migrationStatus || null,
    projectedFromProject: isOnboarding && linked,
    projectedFromProgram: isTraining && linked,
    projectedFromPlan: isPlans && linked,
    projectStatus: isOnboarding && linked ? linkedEntity.status || null : null,
    programStatus: isTraining && linked ? linkedEntity.status || null : null,
    planStatus: isPlans && linked ? linkedEntity.status || null : null,
    linkBroken: linkBroken || false,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, kind: string, tenantId?: string, now?: Date }} args
 */
export async function getFoundationStatus(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }

  const kind = normalizeKind(args.kind);
  if (!kind) {
    return { ok: false, error: 'kind must be onboarding|training|survey|plans' };
  }

  const modelName = MODEL_BY_KIND[kind];
  const model = prisma?.[modelName];

  if (!model || typeof model.findMany !== 'function') {
    return {
      ok: true,
      kind,
      status: CS_FOUNDATION_STATUS.NOT_INSTRUMENTED,
      progressPercent: null,
      items: [],
      meta: {
        reason: 'model_unavailable_or_empty',
        inventProgressForbidden: true,
      },
    };
  }

  const where = {};
  if (args.tenantId) {
    const gate = await assertCsTenantAccess(prisma, args.admin, args.tenantId, {
      now: args.now,
    });
    if (!gate.ok) {
      return { ok: false, forbidden: true, reason: gate.reason };
    }
    where.tenantId = String(args.tenantId);
  } else {
    const scope = await resolveCsPortfolioScope(prisma, args.admin, { now: args.now });
    const tenantFilter = csTenantIdFilter(scope);
    if (tenantFilter) where.tenantId = tenantFilter;
  }

  let rows = [];
  try {
    rows = await model.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  } catch {
    try {
      rows = await model.findMany({ where });
    } catch {
      rows = [];
    }
  }

  if (!rows || rows.length === 0) {
    return {
      ok: true,
      kind,
      status: CS_FOUNDATION_STATUS.NOT_INSTRUMENTED,
      progressPercent: null,
      items: [],
      meta: {
        reason: 'no_source_rows',
        inventProgressForbidden: true,
      },
    };
  }

  const linkedById = new Map();

  if (
    kind === CS_FOUNDATION_KIND.ONBOARDING &&
    typeof prisma.customerOnboardingProject?.findUnique === 'function'
  ) {
    const ids = [
      ...new Set(
        rows.map((r) => r.onboardingProjectId).filter((id) => id != null && id !== '')
      ),
    ];
    for (const id of ids) {
      try {
        const project = await prisma.customerOnboardingProject.findUnique({
          where: { id },
        });
        if (project) linkedById.set(id, project);
      } catch {
        // leave unprojected
      }
    }
  }

  if (
    kind === CS_FOUNDATION_KIND.TRAINING &&
    typeof prisma.customerTrainingProgram?.findUnique === 'function'
  ) {
    const ids = [
      ...new Set(
        rows.map((r) => r.trainingProgramId).filter((id) => id != null && id !== '')
      ),
    ];
    for (const id of ids) {
      try {
        const program = await prisma.customerTrainingProgram.findUnique({
          where: { id },
        });
        if (program) linkedById.set(id, program);
      } catch {
        // leave unprojected
      }
    }
  }

  if (
    kind === CS_FOUNDATION_KIND.PLANS &&
    typeof prisma.customerAdoptionPlan?.findUnique === 'function'
  ) {
    const ids = [
      ...new Set(
        rows.map((r) => r.adoptionPlanId).filter((id) => id != null && id !== '')
      ),
    ];
    for (const id of ids) {
      try {
        const plan = await prisma.customerAdoptionPlan.findUnique({
          where: { id },
        });
        if (plan) linkedById.set(id, plan);
      } catch {
        // leave unprojected
      }
    }
  }

  return {
    ok: true,
    kind,
    status: CS_FOUNDATION_STATUS.INSTRUMENTED,
    // Never derive a completion % — agents read discrete source rows only.
    progressPercent: null,
    items: rows.map((r) => {
      const linkId = linkIdForKind(kind, r);
      return serializeRow(kind, r, linkId ? linkedById.get(linkId) : null);
    }),
    meta: {
      count: rows.length,
      inventProgressForbidden: true,
      inventCompletedForbidden: true,
      projectProjection: kind === CS_FOUNDATION_KIND.ONBOARDING,
      programProjection: kind === CS_FOUNDATION_KIND.TRAINING,
      planProjection: kind === CS_FOUNDATION_KIND.PLANS,
    },
  };
}

export { normalizeKind, MODEL_BY_KIND };
