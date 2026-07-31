/**
 * Demo rehearsals — Phase 14 Wave 3.
 * Rehearsal outcomes + issues; Critical issues block readiness.
 */

import {
  CRM_DEMO_ISSUE_SEVERITY,
  CRM_DEMO_REHEARSAL_OUTCOME,
  CRM_DEMO_REHEARSAL_OUTCOMES,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { appendTimelineEvent } from '../timeline.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import {
  assertSafeDemoContentText,
  assertSafeJsonTree,
  canEditDemoContent,
  canViewDemoContent,
  resolveDemoContentAccess,
} from './versioning.js';

export function hasCrmDemoRehearsalModel(prisma) {
  return typeof prisma?.crmDemoRehearsal?.create === 'function';
}

export function serializeRehearsal(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    checklistExecutionId: row.checklistExecutionId || null,
    outcome: row.outcome,
    issuesJson: row.issuesJson ?? null,
    criticalIssueCount: Number(row.criticalIssueCount) || 0,
    notes: row.notes || null,
    performedAt: row.performedAt ? new Date(row.performedAt).toISOString() : null,
    performedByAdminId: row.performedByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function loadDemo(prisma, demoId) {
  const id = demoId ? String(demoId).trim() : '';
  if (!id || !hasCrmDemoModel(prisma)) return null;
  try {
    if (/^DEMO-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmDemo.findUnique({ where: { demoNumber: id } });
    }
    return await prisma.crmDemo.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function normaliseIssues(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((issue, idx) => ({
    key: String(issue.key || `issue_${idx + 1}`).trim(),
    severity: String(issue.severity || CRM_DEMO_ISSUE_SEVERITY.WARN)
      .trim()
      .toUpperCase(),
    detail: issue.detail != null ? String(issue.detail).trim().slice(0, 1000) : null,
  }));
}

/**
 * Record a rehearsal outcome for a Demo.
 * Critical issues → block readiness when Demo requiresRehearsal.
 */
export async function recordDemoRehearsal(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canEditDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_rehearsal_forbidden' };
  }
  if (!hasCrmDemoRehearsalModel(prisma)) {
    return { ok: false, error: 'crm_demo_rehearsal_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const outcome = String(args.outcome || '')
    .trim()
    .toUpperCase();
  if (!CRM_DEMO_REHEARSAL_OUTCOMES.includes(outcome)) {
    return { ok: false, error: 'invalid_rehearsal_outcome' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmDemoRehearsal.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          rehearsal: serializeRehearsal(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  let issuesJson;
  try {
    issuesJson = assertSafeJsonTree(normaliseIssues(args.issues));
    if (args.notes != null) assertSafeDemoContentText(args.notes);
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const criticalIssueCount = issuesJson.filter(
    (i) => i.severity === CRM_DEMO_ISSUE_SEVERITY.CRITICAL
  ).length;

  // Critical issues force FAILED outcome for readiness honesty
  let finalOutcome = outcome;
  if (criticalIssueCount > 0 && outcome === CRM_DEMO_REHEARSAL_OUTCOME.PASSED) {
    finalOutcome = CRM_DEMO_REHEARSAL_OUTCOME.FAILED;
  }

  const now = args.now || new Date();
  try {
    const row = await prisma.crmDemoRehearsal.create({
      data: {
        demoId: demo.id,
        checklistExecutionId: args.checklistExecutionId
          ? String(args.checklistExecutionId).trim()
          : demo.latestChecklistExecutionId || null,
        outcome: finalOutcome,
        issuesJson,
        criticalIssueCount,
        notes: args.notes != null ? String(args.notes).trim().slice(0, 4000) : null,
        performedAt: now,
        performedByAdminId: args.admin?.id || null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });

    await prisma.crmDemo.update({
      where: { id: demo.id },
      data: {
        latestRehearsalId: row.id,
        updatedAt: now,
      },
    });

    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.DEMO,
      subjectId: demo.id,
      eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REHEARSAL_RECORDED,
      summary: `Demo rehearsal ${finalOutcome} (critical=${criticalIssueCount})`,
      payload: {
        rehearsalId: row.id,
        outcome: finalOutcome,
        criticalIssueCount,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });

    return {
      ok: true,
      rehearsal: serializeRehearsal(row),
      criticalIssueCount,
      outcome: finalOutcome,
      demo: serializeDemo({ ...demo, latestRehearsalId: row.id }),
    };
  } catch (err) {
    if (idempotencyKey && err?.code === 'P2002') {
      const raced = await prisma.crmDemoRehearsal.findUnique({
        where: { idempotencyKey },
      });
      if (raced) {
        return {
          ok: true,
          rehearsal: serializeRehearsal(raced),
          alreadyExists: true,
        };
      }
    }
    return { ok: false, error: err?.message || 'rehearsal_record_failed' };
  }
}

export async function listDemoRehearsals(prisma, args = {}) {
  const access = resolveDemoContentAccess(args.admin);
  if (!canViewDemoContent(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_rehearsal_forbidden' };
  }
  if (!hasCrmDemoRehearsalModel(prisma)) {
    return { ok: false, error: 'crm_demo_rehearsal_model_unavailable', status: 'UNAVAILABLE' };
  }
  const where = {};
  if (args.demoId) {
    const demo = await loadDemo(prisma, args.demoId);
    if (demo) where.demoId = demo.id;
    else where.demoId = String(args.demoId).trim();
  }
  const take = Math.min(
    Math.max(Number(args.limit) || CRM_LIST_DEFAULT_LIMIT, 1),
    CRM_LIST_MAX_LIMIT
  );
  const rows = await prisma.crmDemoRehearsal.findMany({
    where,
    orderBy: { performedAt: 'desc' },
    take,
  });
  return { ok: true, rehearsals: rows.map(serializeRehearsal), count: rows.length };
}
