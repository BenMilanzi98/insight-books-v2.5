/**
 * Demo service — Phase 14 Wave 1.
 * create / get / list / status. Demo ≠ Meeting; no Proposal/Tenant provision.
 */

import {
  CRM_DEMO_STATUS,
  CRM_READINESS_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  canTransitionDemoStatus,
  getDemoDomainContract,
  isValidDemoStatus,
} from './catalogue.js';
import { allocateDemoNumber } from './numbering.js';
import {
  hasCrmDemoModel,
  hasCrmDemoStatusHistoryModel,
  serializeDemo,
  serializeDemoParticipant,
  serializeDemoStatusHistory,
} from './model.js';
import { evaluateDemoReadiness } from './readiness.js';

function canEditDemos(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads
  );
}

function canViewDemos(access) {
  return (
    access.canViewActivities ||
    access.canViewLeads ||
    access.canViewOpportunities ||
    access.canView
  );
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

async function recordStatusHistory(prisma, { demoId, fromStatus, toStatus, reason, adminId, at }) {
  if (!hasCrmDemoStatusHistoryModel(prisma)) return null;
  try {
    return await prisma.crmDemoStatusHistory.create({
      data: {
        demoId,
        fromStatus: fromStatus || null,
        toStatus,
        reason: reason || null,
        changedByAdminId: adminId || null,
        at: at || new Date(),
      },
    });
  } catch {
    return null;
  }
}

/**
 * Create a CrmDemo (DEMO-YYYY-######).
 */
export async function createDemo(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_create_forbidden' };
  }
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  const convertIdempotencyKey = args.convertIdempotencyKey
    ? String(args.convertIdempotencyKey).trim()
    : null;

  if (convertIdempotencyKey) {
    try {
      const existing = await prisma.crmDemo.findUnique({
        where: { convertIdempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          demo: serializeDemo(existing),
          alreadyExists: true,
          domain: getDemoDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmDemo.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          demo: serializeDemo(existing),
          alreadyExists: true,
          domain: getDemoDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateDemoNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'demo_number_allocation_failed' };
  }

  const title =
    args.title != null ? String(args.title).trim().slice(0, 500) : 'Demo';
  const status = args.status
    ? String(args.status).trim().toUpperCase()
    : CRM_DEMO_STATUS.PLANNED;
  if (
    status !== CRM_DEMO_STATUS.DRAFT &&
    status !== CRM_DEMO_STATUS.PLANNED
  ) {
    return { ok: false, error: 'invalid_initial_demo_status' };
  }

  let row;
  try {
    row = await prisma.crmDemo.create({
      data: {
        demoNumber: allocated.number,
        status,
        readinessStatus: CRM_READINESS_STATUS.NOT_READY,
        requestId: args.requestId ? String(args.requestId).trim() : null,
        leadId: args.leadId ? String(args.leadId).trim() : null,
        opportunityId: args.opportunityId
          ? String(args.opportunityId).trim()
          : null,
        accountId: args.accountId ? String(args.accountId).trim() : null,
        contactId: args.contactId ? String(args.contactId).trim() : null,
        title,
        notes: args.notes != null ? String(args.notes).trim().slice(0, 4000) : null,
        ownerAdminId: args.ownerAdminId || args.admin?.id || null,
        createdByAdminId: args.admin?.id || null,
        convertIdempotencyKey,
        idempotencyKey,
        requiresLogicalEnvironment: args.requiresLogicalEnvironment === true,
        requiresChecklist: args.requiresChecklist === true,
        requiresRehearsal: args.requiresRehearsal === true,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (convertIdempotencyKey) {
      try {
        const raced = await prisma.crmDemo.findUnique({
          where: { convertIdempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            demo: serializeDemo(raced),
            alreadyExists: true,
            domain: getDemoDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    if (idempotencyKey) {
      try {
        const raced = await prisma.crmDemo.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            demo: serializeDemo(raced),
            alreadyExists: true,
            domain: getDemoDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || 'demo_create_failed' };
  }

  await recordStatusHistory(prisma, {
    demoId: row.id,
    fromStatus: null,
    toStatus: status,
    reason: 'create',
    adminId: args.admin?.id,
    at: now,
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_CREATED,
    summary: `Demo ${row.demoNumber} created`,
    payload: {
      demoId: row.id,
      demoNumber: row.demoNumber,
      proposalCreated: false,
      tenantProvisioned: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    demo: serializeDemo(row),
    domain: getDemoDomainContract(),
  };
}

/**
 * Get a Demo by id or DEMO- number.
 */
export async function getDemo(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_view_forbidden' };
  }
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadDemo(prisma, args.demoId);
  if (!row) return { ok: false, notFound: true, error: 'demo_not_found' };

  let participants = [];
  if (typeof prisma.crmDemoParticipant?.findMany === 'function') {
    try {
      participants = await prisma.crmDemoParticipant.findMany({
        where: { demoId: row.id },
      });
    } catch {
      participants = [];
    }
  }

  return {
    ok: true,
    demo: serializeDemo(row),
    participants: participants.map(serializeDemoParticipant),
    domain: getDemoDomainContract(),
  };
}

/**
 * List Demos.
 */
export async function listDemos(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_view_forbidden' };
  }
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.ownerAdminId) where.ownerAdminId = String(args.ownerAdminId).trim();
  if (args.leadId) where.leadId = String(args.leadId).trim();
  if (args.opportunityId) where.opportunityId = String(args.opportunityId).trim();
  if (args.requestId) where.requestId = String(args.requestId).trim();

  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
  let rows = [];
  try {
    rows = await prisma.crmDemo.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_list_failed' };
  }

  return {
    ok: true,
    demos: rows.map(serializeDemo),
    count: rows.length,
    domain: getDemoDomainContract(),
  };
}

/**
 * Transition Demo status. READY_TO_DELIVER blocked when readiness blockers present.
 */
export async function transitionDemoStatus(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_status_forbidden' };
  }
  if (!hasCrmDemoModel(prisma)) {
    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };
  }

  const row = await loadDemo(prisma, args.demoId);
  if (!row) return { ok: false, notFound: true, error: 'demo_not_found' };

  const toStatus = String(args.toStatus || args.status || '')
    .trim()
    .toUpperCase();
  if (!isValidDemoStatus(toStatus)) {
    return { ok: false, error: 'invalid_demo_status' };
  }
  if (row.status === toStatus) {
    return { ok: true, demo: serializeDemo(row), alreadyInStatus: true };
  }
  if (!canTransitionDemoStatus(row.status, toStatus)) {
    return {
      ok: false,
      error: 'demo_status_transition_forbidden',
      from: row.status,
      to: toStatus,
    };
  }

  const now = args.now || new Date();

  if (toStatus === CRM_DEMO_STATUS.READY_TO_DELIVER) {
    const readiness = await evaluateDemoReadiness(prisma, {
      admin: args.admin,
      demoId: row.id,
      now,
      persist: true,
    });
    if (!readiness.ok) return readiness;
    if (
      readiness.readinessStatus === CRM_READINESS_STATUS.BLOCKED ||
      readiness.readinessStatus === CRM_READINESS_STATUS.NOT_READY ||
      readiness.blockers?.length
    ) {
      return {
        ok: false,
        error: 'demo_not_ready_to_deliver',
        readinessStatus: readiness.readinessStatus,
        blockers: readiness.blockers,
        items: readiness.items,
      };
    }
  }

  const updated = await prisma.crmDemo.update({
    where: { id: row.id },
    data: {
      status: toStatus,
      updatedAt: now,
    },
  });

  const history = await recordStatusHistory(prisma, {
    demoId: row.id,
    fromStatus: row.status,
    toStatus,
    reason: args.reason || null,
    adminId: args.admin?.id,
    at: now,
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_STATUS_CHANGED,
    summary: `Demo ${row.demoNumber}: ${row.status} → ${toStatus}`,
    payload: { fromStatus: row.status, toStatus },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    demo: serializeDemo(updated),
    history: serializeDemoStatusHistory(history),
    domain: getDemoDomainContract(),
  };
}

export { loadDemo, canEditDemos, canViewDemos };
