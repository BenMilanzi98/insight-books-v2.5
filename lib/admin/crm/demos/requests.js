/**
 * Demo Requests — Phase 14 Wave 1.
 * Convert Demo Request ≠ create Opportunity; convert is idempotent.
 */

import {
  CRM_DEMO_REQUEST_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import { allocateDemoRequestNumber } from './numbering.js';
import {
  hasCrmDemoModel,
  hasCrmDemoRequestModel,
  serializeDemo,
  serializeDemoRequest,
} from './model.js';
import { createDemo } from './service.js';

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

async function loadRequest(prisma, requestId) {
  const id = requestId ? String(requestId).trim() : '';
  if (!id || !hasCrmDemoRequestModel(prisma)) return null;
  try {
    if (/^DMR-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmDemoRequest.findUnique({ where: { requestNumber: id } });
    }
    return await prisma.crmDemoRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create a Demo Request (DMR-YYYY-######).
 */
export async function createDemoRequest(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_request_create_forbidden' };
  }
  if (!hasCrmDemoRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmDemoRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          request: serializeDemoRequest(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateDemoRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'demo_request_number_allocation_failed',
    };
  }

  const title =
    args.title != null ? String(args.title).trim().slice(0, 500) : 'Demo request';
  const ownerAdminId = args.ownerAdminId || args.admin?.id || null;

  let row;
  try {
    row = await prisma.crmDemoRequest.create({
      data: {
        requestNumber: allocated.number,
        status: CRM_DEMO_REQUEST_STATUS.NEW,
        leadId: args.leadId ? String(args.leadId).trim() : null,
        opportunityId: args.opportunityId
          ? String(args.opportunityId).trim()
          : null,
        accountId: args.accountId ? String(args.accountId).trim() : null,
        contactId: args.contactId ? String(args.contactId).trim() : null,
        title,
        notes: args.notes != null ? String(args.notes).trim().slice(0, 4000) : null,
        source: args.source ? String(args.source).trim().slice(0, 80) : null,
        ownerAdminId,
        createdByAdminId: args.admin?.id || null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (idempotencyKey) {
      try {
        const raced = await prisma.crmDemoRequest.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            request: serializeDemoRequest(raced),
            alreadyExists: true,
          };
        }
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: err?.message || 'demo_request_create_failed',
    };
  }

  await appendTimelineEvent(prisma, {
    subjectType: row.leadId
      ? CRM_SUBJECT_TYPE.LEAD
      : row.opportunityId
        ? CRM_SUBJECT_TYPE.OPPORTUNITY
        : CRM_SUBJECT_TYPE.CONTACT,
    subjectId: row.leadId || row.opportunityId || row.contactId || row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REQUEST_CREATED,
    summary: `Demo request ${row.requestNumber} created`,
    payload: { requestId: row.id, requestNumber: row.requestNumber },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, request: serializeDemoRequest(row) };
}

/**
 * Qualify a Demo Request → QUALIFIED (from NEW / QUALIFYING).
 */
export async function qualifyDemoRequest(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_request_qualify_forbidden' };
  }
  if (!hasCrmDemoRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'demo_request_not_found' };

  if (row.status === CRM_DEMO_REQUEST_STATUS.QUALIFIED) {
    return { ok: true, request: serializeDemoRequest(row), alreadyQualified: true };
  }
  if (row.status === CRM_DEMO_REQUEST_STATUS.CONVERTED) {
    return { ok: false, error: 'demo_request_already_converted' };
  }
  if (
    row.status !== CRM_DEMO_REQUEST_STATUS.NEW &&
    row.status !== CRM_DEMO_REQUEST_STATUS.QUALIFYING
  ) {
    return { ok: false, error: 'demo_request_not_qualifiable', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmDemoRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_REQUEST_STATUS.QUALIFIED,
      qualifiedAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: updated.leadId
      ? CRM_SUBJECT_TYPE.LEAD
      : CRM_SUBJECT_TYPE.OPPORTUNITY,
    subjectId: updated.leadId || updated.opportunityId || updated.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REQUEST_QUALIFIED,
    summary: `Demo request ${updated.requestNumber} qualified`,
    payload: { requestId: updated.id },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, request: serializeDemoRequest(updated) };
}

/**
 * Reject a Demo Request.
 */
export async function rejectDemoRequest(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_request_reject_forbidden' };
  }
  if (!hasCrmDemoRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'demo_request_not_found' };

  if (row.status === CRM_DEMO_REQUEST_STATUS.REJECTED) {
    return { ok: true, request: serializeDemoRequest(row), alreadyRejected: true };
  }
  if (row.status === CRM_DEMO_REQUEST_STATUS.CONVERTED) {
    return { ok: false, error: 'demo_request_already_converted' };
  }

  const now = args.now || new Date();
  const reason =
    args.reason != null ? String(args.reason).trim().slice(0, 1000) : null;

  const updated = await prisma.crmDemoRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_REQUEST_STATUS.REJECTED,
      rejectedReason: reason,
      rejectedAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: updated.leadId
      ? CRM_SUBJECT_TYPE.LEAD
      : CRM_SUBJECT_TYPE.OPPORTUNITY,
    subjectId: updated.leadId || updated.opportunityId || updated.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REQUEST_REJECTED,
    summary: `Demo request ${updated.requestNumber} rejected`,
    payload: { requestId: updated.id, reason },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, request: serializeDemoRequest(updated) };
}

/**
 * Convert QUALIFIED Demo Request → CrmDemo (idempotent; stable key).
 * Exact retry returns existing Demo. Never creates Opportunity / Proposal / Tenant.
 */
export async function convertDemoRequest(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_request_convert_forbidden' };
  }
  if (!hasCrmDemoRequestModel(prisma) || !hasCrmDemoModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await loadRequest(prisma, args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'demo_request_not_found' };

  const convertKey = `dmr-convert:${row.id}`;

  if (row.status === CRM_DEMO_REQUEST_STATUS.CONVERTED && row.convertedDemoId) {
    try {
      const existingDemo = await prisma.crmDemo.findUnique({
        where: { id: row.convertedDemoId },
      });
      if (existingDemo) {
        return {
          ok: true,
          request: serializeDemoRequest(row),
          demo: serializeDemo(existingDemo),
          alreadyExists: true,
        };
      }
    } catch {
      // fall through to key lookup
    }
  }

  try {
    const byKey = await prisma.crmDemo.findUnique({
      where: { convertIdempotencyKey: convertKey },
    });
    if (byKey) {
      return {
        ok: true,
        request: serializeDemoRequest(row),
        demo: serializeDemo(byKey),
        alreadyExists: true,
      };
    }
  } catch {
    // continue
  }

  if (
    row.status !== CRM_DEMO_REQUEST_STATUS.QUALIFIED &&
    row.status !== CRM_DEMO_REQUEST_STATUS.CONVERTED
  ) {
    return {
      ok: false,
      error: 'demo_request_must_be_qualified',
      status: row.status,
    };
  }

  const now = args.now || new Date();
  const demoResult = await createDemo(prisma, {
    admin: args.admin,
    title: args.title || row.title || `Demo from ${row.requestNumber}`,
    notes: args.notes != null ? args.notes : row.notes,
    leadId: row.leadId,
    opportunityId: row.opportunityId,
    accountId: row.accountId,
    contactId: row.contactId,
    requestId: row.id,
    ownerAdminId: args.ownerAdminId || row.ownerAdminId || args.admin?.id,
    convertIdempotencyKey: convertKey,
    idempotencyKey: args.idempotencyKey || convertKey,
    now,
  });

  if (!demoResult.ok) {
    if (demoResult.alreadyExists && demoResult.demo) {
      // Ensure request points at existing demo
      const patched = await prisma.crmDemoRequest.update({
        where: { id: row.id },
        data: {
          status: CRM_DEMO_REQUEST_STATUS.CONVERTED,
          convertedDemoId: demoResult.demo.id,
          convertIdempotencyKey: convertKey,
          convertedAt: row.convertedAt || now,
          updatedAt: now,
        },
      });
      return {
        ok: true,
        request: serializeDemoRequest(patched),
        demo: demoResult.demo,
        alreadyExists: true,
      };
    }
    return demoResult;
  }

  const updated = await prisma.crmDemoRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_DEMO_REQUEST_STATUS.CONVERTED,
      convertedDemoId: demoResult.demo.id,
      convertIdempotencyKey: convertKey,
      convertedAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demoResult.demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REQUEST_CONVERTED,
    summary: `Demo request ${updated.requestNumber} → ${demoResult.demo.demoNumber}`,
    payload: {
      requestId: updated.id,
      demoId: demoResult.demo.id,
      opportunityCreated: false,
      proposalCreated: false,
      tenantProvisioned: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    request: serializeDemoRequest(updated),
    demo: demoResult.demo,
    alreadyExists: Boolean(demoResult.alreadyExists),
  };
}

/**
 * List Demo Requests (thin portfolio list).
 */
export async function listDemoRequests(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_request_view_forbidden' };
  }
  if (!hasCrmDemoRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.ownerAdminId) where.ownerAdminId = String(args.ownerAdminId).trim();
  if (args.leadId) where.leadId = String(args.leadId).trim();
  if (args.opportunityId) where.opportunityId = String(args.opportunityId).trim();

  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
  let rows = [];
  try {
    rows = await prisma.crmDemoRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    return { ok: false, error: err?.message || 'demo_request_list_failed' };
  }

  return {
    ok: true,
    requests: rows.map(serializeDemoRequest),
    count: rows.length,
  };
}

export { loadRequest as loadDemoRequest };
