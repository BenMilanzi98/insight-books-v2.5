/**
 * Demo delivery session — Phase 14 Wave 4.
 * Meeting COMPLETED ≠ Demo DELIVERED. Agenda coverage / live issues / questions.
 */

import {
  CRM_DEMO_ISSUE_SEVERITY,
  CRM_DEMO_ISSUE_STATUS,
  CRM_DEMO_QUESTION_STATUS,
  CRM_DEMO_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoDomainContract } from './catalogue.js';
import { hasCrmDemoModel, serializeDemo } from './model.js';
import { canEditDemos, canViewDemos, loadDemo } from './service.js';
import { transitionDemoStatus } from './service.js';

export function hasCrmDemoDeliverySessionModel(prisma) {
  return typeof prisma?.crmDemoDeliverySession?.create === 'function';
}

export function hasCrmDemoLiveIssueModel(prisma) {
  return typeof prisma?.crmDemoLiveIssue?.create === 'function';
}

export function hasCrmDemoCustomerQuestionModel(prisma) {
  return typeof prisma?.crmDemoCustomerQuestion?.create === 'function';
}

export function serializeDeliverySession(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    status: row.status,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : null,
    startedByAdminId: row.startedByAdminId || null,
    endedByAdminId: row.endedByAdminId || null,
    agendaCoverageJson: row.agendaCoverageJson ?? null,
    notes: row.notes || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeLiveIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    deliverySessionId: row.deliverySessionId || null,
    severity: row.severity,
    status: row.status,
    summary: row.summary || null,
    detail: row.detail || null,
    recordedByAdminId: row.recordedByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeCustomerQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    deliverySessionId: row.deliverySessionId || null,
    question: row.question,
    answer: row.answer || null,
    status: row.status,
    askedBy: row.askedBy || null,
    recordedByAdminId: row.recordedByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Start delivery session — transitions Demo → IN_DELIVERY.
 */
export async function startDemoDelivery(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_forbidden' };
  }
  if (!hasCrmDemoModel(prisma) || !hasCrmDemoDeliverySessionModel(prisma)) {
    return { ok: false, error: 'crm_demo_delivery_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    const existing = await prisma.crmDemoDeliverySession.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        session: serializeDeliverySession(existing),
        demo: serializeDemo(demo),
        idempotentReplay: true,
        domain: getDemoDomainContract(),
      };
    }
  }

  const open = await prisma.crmDemoDeliverySession.findFirst({
    where: { demoId: demo.id, status: 'IN_PROGRESS' },
  });
  if (open) {
    return {
      ok: true,
      session: serializeDeliverySession(open),
      demo: serializeDemo(demo),
      alreadyInDelivery: true,
      domain: getDemoDomainContract(),
    };
  }

  const now = args.now || new Date();
  if (demo.status === CRM_DEMO_STATUS.READY_TO_DELIVER) {
    const transitioned = await transitionDemoStatus(prisma, {
      admin: args.admin,
      demoId: demo.id,
      toStatus: CRM_DEMO_STATUS.IN_DELIVERY,
      reason: 'delivery_started',
      now,
    });
    if (!transitioned.ok) return transitioned;
  } else if (demo.status !== CRM_DEMO_STATUS.IN_DELIVERY) {
    return {
      ok: false,
      error: 'demo_not_ready_for_delivery',
      status: demo.status,
    };
  }

  const session = await prisma.crmDemoDeliverySession.create({
    data: {
      demoId: demo.id,
      status: 'IN_PROGRESS',
      startedAt: now,
      startedByAdminId: args.admin?.id || null,
      agendaCoverageJson: args.agendaCoverageJson ?? null,
      notes: args.notes != null ? String(args.notes).trim() : null,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.crmDemo.update({
    where: { id: demo.id },
    data: { latestDeliverySessionId: session.id, updatedAt: now },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_DELIVERY_STARTED,
    summary: `Demo delivery started: ${demo.demoNumber}`,
    payload: { sessionId: session.id },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const refreshed = await loadDemo(prisma, demo.id);
  return {
    ok: true,
    session: serializeDeliverySession(session),
    demo: serializeDemo(refreshed),
    domain: getDemoDomainContract(),
  };
}

/**
 * End delivery — transitions Demo → DELIVERED. Meeting COMPLETED never aliases this.
 */
export async function endDemoDelivery(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_forbidden' };
  }
  if (!hasCrmDemoDeliverySessionModel(prisma)) {
    return { ok: false, error: 'crm_demo_delivery_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  let session = null;
  if (args.sessionId) {
    session = await prisma.crmDemoDeliverySession.findUnique({
      where: { id: String(args.sessionId).trim() },
    });
  } else {
    session = await prisma.crmDemoDeliverySession.findFirst({
      where: { demoId: demo.id, status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });
  }
  if (!session) return { ok: false, notFound: true, error: 'delivery_session_not_found' };
  if (session.demoId !== demo.id) {
    return { ok: false, error: 'delivery_session_demo_mismatch' };
  }

  const now = args.now || new Date();
  if (session.status === 'COMPLETED' && session.endedAt) {
    return {
      ok: true,
      session: serializeDeliverySession(session),
      demo: serializeDemo(demo),
      alreadyEnded: true,
      domain: getDemoDomainContract(),
    };
  }

  const updated = await prisma.crmDemoDeliverySession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      endedAt: now,
      endedByAdminId: args.admin?.id || null,
      agendaCoverageJson:
        args.agendaCoverageJson !== undefined
          ? args.agendaCoverageJson
          : session.agendaCoverageJson,
      notes:
        args.notes !== undefined
          ? args.notes != null
            ? String(args.notes).trim()
            : null
          : session.notes,
      updatedAt: now,
    },
  });

  if (
    demo.status === CRM_DEMO_STATUS.IN_DELIVERY ||
    demo.status === CRM_DEMO_STATUS.READY_TO_DELIVER
  ) {
    const transitioned = await transitionDemoStatus(prisma, {
      admin: args.admin,
      demoId: demo.id,
      toStatus: CRM_DEMO_STATUS.DELIVERED,
      reason: 'delivery_ended',
      now,
    });
    if (!transitioned.ok && !transitioned.alreadyInStatus) return transitioned;
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_DELIVERY_ENDED,
    summary: `Demo delivery ended: ${demo.demoNumber}`,
    payload: {
      sessionId: session.id,
      meetingCompletedEqualsDemoDelivered: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  const refreshed = await loadDemo(prisma, demo.id);
  return {
    ok: true,
    session: serializeDeliverySession(updated),
    demo: serializeDemo(refreshed),
    domain: getDemoDomainContract(),
  };
}

/**
 * Record agenda item coverage during/after delivery.
 */
export async function recordAgendaCoverage(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_forbidden' };
  }
  if (!hasCrmDemoDeliverySessionModel(prisma)) {
    return { ok: false, error: 'crm_demo_delivery_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  let session = null;
  if (args.sessionId) {
    session = await prisma.crmDemoDeliverySession.findUnique({
      where: { id: String(args.sessionId).trim() },
    });
  } else if (demo.latestDeliverySessionId) {
    session = await prisma.crmDemoDeliverySession.findUnique({
      where: { id: demo.latestDeliverySessionId },
    });
  }
  if (!session) return { ok: false, notFound: true, error: 'delivery_session_not_found' };

  const coverage = Array.isArray(args.coverage)
    ? args.coverage
    : args.agendaCoverageJson;
  if (!coverage) return { ok: false, error: 'coverage_required' };

  const now = args.now || new Date();
  const updated = await prisma.crmDemoDeliverySession.update({
    where: { id: session.id },
    data: { agendaCoverageJson: coverage, updatedAt: now },
  });

  return {
    ok: true,
    session: serializeDeliverySession(updated),
    domain: getDemoDomainContract(),
  };
}

export async function recordLiveIssue(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_forbidden' };
  }
  if (!hasCrmDemoLiveIssueModel(prisma)) {
    return { ok: false, error: 'crm_demo_live_issue_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const summary = args.summary != null ? String(args.summary).trim() : '';
  if (!summary) return { ok: false, error: 'summary_required' };

  const severity = String(args.severity || CRM_DEMO_ISSUE_SEVERITY.MEDIUM)
    .trim()
    .toUpperCase();
  if (!Object.values(CRM_DEMO_ISSUE_SEVERITY).includes(severity)) {
    return { ok: false, error: 'invalid_severity' };
  }

  const now = args.now || new Date();
  const row = await prisma.crmDemoLiveIssue.create({
    data: {
      demoId: demo.id,
      deliverySessionId: args.deliverySessionId
        ? String(args.deliverySessionId).trim()
        : demo.latestDeliverySessionId || null,
      severity,
      status: CRM_DEMO_ISSUE_STATUS.OPEN,
      summary,
      detail: args.detail != null ? String(args.detail).trim() : null,
      recordedByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, issue: serializeLiveIssue(row), domain: getDemoDomainContract() };
}

export async function recordCustomerQuestion(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_forbidden' };
  }
  if (!hasCrmDemoCustomerQuestionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_customer_question_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const question = args.question != null ? String(args.question).trim() : '';
  if (!question) return { ok: false, error: 'question_required' };

  const now = args.now || new Date();
  const answer =
    args.answer != null && String(args.answer).trim()
      ? String(args.answer).trim()
      : null;
  const row = await prisma.crmDemoCustomerQuestion.create({
    data: {
      demoId: demo.id,
      deliverySessionId: args.deliverySessionId
        ? String(args.deliverySessionId).trim()
        : demo.latestDeliverySessionId || null,
      question,
      answer,
      status: answer
        ? CRM_DEMO_QUESTION_STATUS.ANSWERED
        : CRM_DEMO_QUESTION_STATUS.OPEN,
      askedBy: args.askedBy != null ? String(args.askedBy).trim() : null,
      recordedByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    question: serializeCustomerQuestion(row),
    domain: getDemoDomainContract(),
  };
}

export async function getDemoDeliverySession(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_delivery_view_forbidden' };
  }
  if (!hasCrmDemoDeliverySessionModel(prisma)) {
    return { ok: false, error: 'crm_demo_delivery_model_unavailable', status: 'UNAVAILABLE' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  let session = null;
  if (args.sessionId) {
    session = await prisma.crmDemoDeliverySession.findUnique({
      where: { id: String(args.sessionId).trim() },
    });
  } else if (demo.latestDeliverySessionId) {
    session = await prisma.crmDemoDeliverySession.findUnique({
      where: { id: demo.latestDeliverySessionId },
    });
  } else {
    session = await prisma.crmDemoDeliverySession.findFirst({
      where: { demoId: demo.id },
      orderBy: { startedAt: 'desc' },
    });
  }

  return {
    ok: true,
    session: serializeDeliverySession(session),
    demo: serializeDemo(demo),
    domain: getDemoDomainContract(),
  };
}
