/**
 * Demo feedback forms + responses — Phase 14 Wave 4.
 * Optional; never invent scores; completeness ≠ outcome success.
 */

import {
  CRM_DEMO_VERSION_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoDomainContract } from './catalogue.js';
import { canEditDemos, canViewDemos, loadDemo } from './service.js';

export function hasCrmDemoFeedbackFormModel(prisma) {
  return typeof prisma?.crmDemoFeedbackForm?.create === 'function';
}

export function hasCrmDemoFeedbackResponseModel(prisma) {
  return typeof prisma?.crmDemoFeedbackResponse?.create === 'function';
}

export function serializeFeedbackForm(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    fieldsJson: row.fieldsJson ?? null,
    authoredByAdminId: row.authoredByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeFeedbackResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    formId: row.formId || null,
    score: row.score != null ? Number(row.score) : null,
    responsesJson: row.responsesJson ?? null,
    submittedBy: row.submittedBy || null,
    recordedByAdminId: row.recordedByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function createFeedbackFormVersion(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_feedback_forbidden' };
  }
  if (!hasCrmDemoFeedbackFormModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_feedback_form_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const code = args.code != null ? String(args.code).trim().toUpperCase() : '';
  if (!code) return { ok: false, error: 'code_required' };

  const latest = await prisma.crmDemoFeedbackForm.findFirst({
    where: { code },
    orderBy: { version: 'desc' },
  });
  const version = latest ? latest.version + 1 : 1;
  const now = args.now || new Date();

  const row = await prisma.crmDemoFeedbackForm.create({
    data: {
      code,
      version,
      status: CRM_DEMO_VERSION_STATUS.DRAFT,
      name: args.name != null ? String(args.name).trim() : null,
      fieldsJson: args.fieldsJson ?? args.fields ?? null,
      authoredByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, form: serializeFeedbackForm(row) };
}

export async function recordDemoFeedbackResponse(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_feedback_forbidden' };
  }
  if (!hasCrmDemoFeedbackResponseModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_feedback_response_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    const existing = await prisma.crmDemoFeedbackResponse.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        response: serializeFeedbackResponse(existing),
        idempotentReplay: true,
        inventScoresForbidden: true,
      };
    }
  }

  let score = null;
  if (args.score != null && args.score !== '') {
    const n = Number(args.score);
    if (Number.isNaN(n)) return { ok: false, error: 'invalid_score' };
    score = n;
  }

  const now = args.now || new Date();
  const row = await prisma.crmDemoFeedbackResponse.create({
    data: {
      demoId: demo.id,
      formId: args.formId ? String(args.formId).trim() : null,
      score,
      responsesJson: args.responsesJson ?? args.responses ?? null,
      submittedBy: args.submittedBy != null ? String(args.submittedBy).trim() : null,
      recordedByAdminId: args.admin?.id || null,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_FEEDBACK_RECORDED,
    summary: `Demo feedback recorded${score != null ? ` (score ${score})` : ''}`,
    payload: { responseId: row.id, score, inventScoresForbidden: true },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    response: serializeFeedbackResponse(row),
    inventScoresForbidden: true,
    domain: getDemoDomainContract(),
  };
}

export async function listDemoFeedbackResponses(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_demo_feedback_view_forbidden',
      items: [],
    };
  }
  if (!hasCrmDemoFeedbackResponseModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, status: 'UNAVAILABLE' },
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found', items: [] };

  const rows = await prisma.crmDemoFeedbackResponse.findMany({
    where: { demoId: demo.id },
    orderBy: { createdAt: 'desc' },
    take: Math.min(100, Number(args.limit) || 50),
  });

  return {
    ok: true,
    items: (rows || []).map(serializeFeedbackResponse),
    meta: { count: (rows || []).length, inventScoresForbidden: true },
  };
}
