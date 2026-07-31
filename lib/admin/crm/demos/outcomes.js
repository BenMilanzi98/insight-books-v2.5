/**
 * Demo outcome service — Phase 14 Wave 4.
 * Outcome ≠ win probability ≠ Closed Won ≠ Revenue.
 * Never auto-mutates Opportunity stage / probability / close date.
 * Completeness ≠ success.
 */

import {
  CRM_DEMO_OUTCOME_COMPLETENESS,
  CRM_DEMO_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  getDemoDomainContract,
  isValidDemoOutcomeCode,
  isValidDemoOutcomeCompleteness,
} from './catalogue.js';
import { serializeDemo } from './model.js';
import { canEditDemos, canViewDemos, loadDemo, transitionDemoStatus } from './service.js';

export function hasCrmDemoOutcomeModel(prisma) {
  return typeof prisma?.crmDemoOutcome?.create === 'function';
}

export function serializeDemoOutcome(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    outcomeCode: row.outcomeCode,
    completeness: row.completeness,
    success: row.success === true,
    notes: row.notes || null,
    opportunityId: row.opportunityId || null,
    opportunityMutated: false,
    stageChanged: false,
    probabilityChanged: false,
    closeDateChanged: false,
    recordedByAdminId: row.recordedByAdminId || null,
    recordedAt: row.recordedAt ? new Date(row.recordedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Record Demo outcome. Completeness optional and ≠ success.
 * Never touches Opportunity stage/probability/closeDate.
 */
export async function recordDemoOutcome(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_outcome_forbidden' };
  }
  if (!hasCrmDemoOutcomeModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_outcome_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const outcomeCode = String(args.outcomeCode || args.outcome || '')
    .trim()
    .toUpperCase();
  if (!isValidDemoOutcomeCode(outcomeCode)) {
    return { ok: false, error: 'invalid_outcome_code' };
  }

  const completeness = String(
    args.completeness || CRM_DEMO_OUTCOME_COMPLETENESS.COMPLETE
  )
    .trim()
    .toUpperCase();
  if (!isValidDemoOutcomeCompleteness(completeness)) {
    return { ok: false, error: 'invalid_completeness' };
  }

  // Completeness ≠ success — success must be explicit, never inferred from COMPLETE
  const success =
    args.success === true
      ? true
      : args.success === false
        ? false
        : false;

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `demo-outcome:${demo.id}:${outcomeCode}`;

  const existing = await prisma.crmDemoOutcome.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      outcome: serializeDemoOutcome(existing),
      demo: serializeDemo(demo),
      opportunityMutated: false,
      idempotentReplay: true,
      domain: getDemoDomainContract(),
    };
  }

  const now = args.now || new Date();

  // Honesty: refuse any attempt to pass opportunity mutation flags
  if (
    args.mutateOpportunity === true ||
    args.updateStage === true ||
    args.updateProbability === true ||
    args.updateCloseDate === true ||
    args.opportunityStage != null ||
    args.winProbability != null
  ) {
    return {
      ok: false,
      error: 'auto_opportunity_mutation_forbidden',
      domain: getDemoDomainContract(),
    };
  }

  const row = await prisma.crmDemoOutcome.create({
    data: {
      demoId: demo.id,
      outcomeCode,
      completeness,
      success,
      notes: args.notes != null ? String(args.notes).trim() : null,
      opportunityId: demo.opportunityId || null,
      recordedByAdminId: args.admin?.id || null,
      recordedAt: now,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { latestOutcomeId: row.id, updatedAt: now },
  });

  if (
    demo.status === CRM_DEMO_STATUS.DELIVERED ||
    demo.status === CRM_DEMO_STATUS.IN_DELIVERY
  ) {
    const transitioned = await transitionDemoStatus(prisma, {
      admin: args.admin,
      demoId: demo.id,
      toStatus: CRM_DEMO_STATUS.OUTCOME_RECORDED,
      reason: 'outcome_recorded',
      now,
    });
    if (!transitioned.ok && !transitioned.alreadyInStatus) {
      // Non-fatal if already past; still return outcome
    }
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_OUTCOME_RECORDED,
    summary: `Demo outcome: ${outcomeCode} (completeness=${completeness}, success=${success})`,
    payload: {
      outcomeCode,
      completeness,
      success,
      opportunityMutated: false,
      completenessEqualsSuccess: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const refreshed = await loadDemo(prisma, demo.id);
  return {
    ok: true,
    outcome: serializeDemoOutcome(row),
    demo: serializeDemo(refreshed),
    opportunityMutated: false,
    stageChanged: false,
    probabilityChanged: false,
    closeDateChanged: false,
    domain: getDemoDomainContract(),
  };
}

export async function getDemoOutcome(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_outcome_view_forbidden' };
  }
  if (!hasCrmDemoOutcomeModel(prisma)) {
    return {
      ok: true,
      outcome: null,
      meta: { unavailable: true, status: 'UNAVAILABLE' },
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  let row = null;
  if (demo.latestOutcomeId) {
    row = await prisma.crmDemoOutcome.findUnique({
      where: { id: demo.latestOutcomeId },
    });
  }
  if (!row) {
    row = await prisma.crmDemoOutcome.findFirst({
      where: { demoId: demo.id },
      orderBy: { recordedAt: 'desc' },
    });
  }

  return {
    ok: true,
    outcome: serializeDemoOutcome(row),
    domain: getDemoDomainContract(),
  };
}
