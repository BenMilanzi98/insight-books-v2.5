/**
 * Support tickets — create / list / get / transitionStatus (Phase 10 Wave 1).
 * Distinct from CsCase. Never mutates billing / MRA fiscal / Tenant GL.
 */

import {
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_TYPE,
  SUPPORT_SOURCE_CHANNEL,
  SUPPORT_IMPACT,
  SUPPORT_URGENCY,
  SUPPORT_PRIORITY,
  SUPPORT_SEVERITY,
  SUPPORT_LIST_MAX_LIMIT,
  SUPPORT_LIST_DEFAULT_LIMIT,
  SUPPORT_TICKET_NUMBER_RE,
  SUPPORT_QUEUE_CODE,
  defaultPriority,
} from './catalogue.js';
import { allocateTicketNumber } from './numbering.js';
import { assertTransition } from './stateMachine.js';
import { resolveSupportAccess, resolveSupportQueueScope } from './authz.js';
import { startClocksOnTicketCreate, onTicketStatusChangeForSla } from './sla/index.js';

const SUPPORT_IMPACT_SET = new Set(Object.values(SUPPORT_IMPACT));
const SUPPORT_URGENCY_SET = new Set(Object.values(SUPPORT_URGENCY));
const SUPPORT_PRIORITY_SET = new Set(Object.values(SUPPORT_PRIORITY));
const SUPPORT_SEVERITY_SET = new Set(Object.values(SUPPORT_SEVERITY));
const SUPPORT_TICKET_TYPE_SET = new Set(Object.values(SUPPORT_TICKET_TYPE));

export function hasSupportTicketModel(prisma) {
  return typeof prisma?.supportTicket?.findMany === 'function';
}

function serializeTicket(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    tenantId: row.tenantId,
    portfolioId: row.portfolioId || null,
    status: row.status,
    type: row.type,
    impact: row.impact || null,
    urgency: row.urgency || null,
    priority: row.priority || null,
    severity: row.severity || null,
    title: row.title,
    description: row.description || null,
    resolutionCategory: row.resolutionCategory || null,
    createdByAdminId: row.createdByAdminId || null,
    assigneeAdminId: row.assigneeAdminId || null,
    queueCode: row.queueCode || null,
    sourceChannel: row.sourceChannel || SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : null,
  };
}

async function appendStatusHistory(prisma, {
  ticketId,
  fromStatus,
  toStatus,
  changedByAdminId,
  reason,
  at,
}) {
  if (typeof prisma.supportTicketStatusHistory?.create !== 'function') return null;
  return prisma.supportTicketStatusHistory.create({
    data: {
      ticketId,
      fromStatus: fromStatus || null,
      toStatus,
      changedByAdminId: changedByAdminId || null,
      reason: reason || null,
      at: at || new Date(),
    },
  });
}

/**
 * Create a SupportTicket (status NEW only; sourceChannel ADMIN_MANUAL).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   tenantId: string,
 *   title: string,
 *   description: string,
 *   type?: string,
 *   impact?: string,
 *   urgency?: string,
 *   priority?: string,
 *   severity?: string,
 *   portfolioId?: string|null,
 *   assigneeAdminId?: string|null,
 *   queueCode?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createTicket(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canCreateTickets) {
    return { ok: false, forbidden: true, reason: 'support_create_forbidden' };
  }

  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  const title = args.title ? String(args.title).trim() : '';
  const description = args.description != null ? String(args.description) : '';
  if (!tenantId || !title) {
    return { ok: false, error: 'tenantId and title required' };
  }

  if (!hasSupportTicketModel(prisma)) {
    return { ok: false, error: 'support_ticket_model_unavailable', status: 'UNAVAILABLE' };
  }

  const type = args.type
    ? String(args.type).trim().toUpperCase()
    : SUPPORT_TICKET_TYPE.OTHER;
  if (!SUPPORT_TICKET_TYPE_SET.has(type)) {
    return { ok: false, error: 'invalid_ticket_type', type };
  }

  const impact = args.impact
    ? String(args.impact).trim().toUpperCase()
    : SUPPORT_IMPACT.UNKNOWN;
  if (!SUPPORT_IMPACT_SET.has(impact)) {
    return { ok: false, error: 'invalid_impact', impact };
  }

  const urgency = args.urgency
    ? String(args.urgency).trim().toUpperCase()
    : SUPPORT_URGENCY.NORMAL;
  if (!SUPPORT_URGENCY_SET.has(urgency)) {
    return { ok: false, error: 'invalid_urgency', urgency };
  }

  const priority = args.priority
    ? String(args.priority).trim().toUpperCase()
    : defaultPriority(impact, urgency);
  if (!SUPPORT_PRIORITY_SET.has(priority)) {
    return { ok: false, error: 'invalid_priority', priority };
  }

  const severity = args.severity
    ? String(args.severity).trim().toUpperCase()
    : SUPPORT_SEVERITY.UNKNOWN;
  if (!SUPPORT_SEVERITY_SET.has(severity)) {
    return { ok: false, error: 'invalid_severity', severity };
  }

  const now = args.now || new Date();
  const allocated = await allocateTicketNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'ticket_number_allocation_failed' };
  }

  const row = await prisma.supportTicket.create({
    data: {
      ticketNumber: allocated.ticketNumber,
      tenantId,
      portfolioId: args.portfolioId || null,
      status: SUPPORT_TICKET_STATUS.NEW,
      type,
      impact,
      urgency,
      priority,
      severity,
      title,
      description,
      resolutionCategory: null,
      createdByAdminId: args.admin?.id || null,
      assigneeAdminId: args.assigneeAdminId || null,
      queueCode: args.queueCode || null,
      sourceChannel: SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendStatusHistory(prisma, {
    ticketId: row.id,
    fromStatus: null,
    toStatus: SUPPORT_TICKET_STATUS.NEW,
    changedByAdminId: args.admin?.id || null,
    reason: 'created',
    at: now,
  });

  // Wave 3: start FIRST_RESPONSE (+ RESOLUTION) — soft-fail if SLA tables unavailable
  try {
    await startClocksOnTicketCreate(prisma, { ticketId: row.id, now });
  } catch {
    // never block ticket create on SLA
  }

  return {
    ok: true,
    created: true,
    ticket: serializeTicket(row),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, id: string }} args — id may be cuid or ticketNumber
 */
export async function getTicket(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden' };
  }

  const id = args.id ? String(args.id).trim() : '';
  if (!id) return { ok: false, error: 'id required' };

  if (!hasSupportTicketModel(prisma)) {
    return { ok: false, error: 'support_ticket_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    if (SUPPORT_TICKET_NUMBER_RE.test(id)) {
      row = await prisma.supportTicket.findUnique({ where: { ticketNumber: id } });
    } else {
      row = await prisma.supportTicket.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.supportTicket.findFirst === 'function') {
      row = await prisma.supportTicket.findFirst({
        where: { OR: [{ id }, { ticketNumber: id }] },
      });
    }
  } catch {
    row = null;
  }

  if (!row) return { ok: false, notFound: true, error: 'ticket_not_found' };

  let history = [];
  if (typeof prisma.supportTicketStatusHistory?.findMany === 'function') {
    try {
      history = await prisma.supportTicketStatusHistory.findMany({
        where: { ticketId: row.id },
        orderBy: { at: 'asc' },
      });
    } catch {
      history = [];
    }
  }

  return {
    ok: true,
    ticket: serializeTicket(row),
    statusHistory: (history || []).map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus || null,
      toStatus: h.toStatus,
      changedByAdminId: h.changedByAdminId || null,
      reason: h.reason || null,
      at: h.at ? new Date(h.at).toISOString() : null,
    })),
  };
}

/**
 * Bounded list — never unbounded.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   status?: string|string[],
 *   tenantId?: string,
 *   assigneeAdminId?: string|null,
 *   myWork?: boolean,
 *   limit?: number|string,
 *   offset?: number|string,
 *   cursor?: string,
 * }} args
 */
export async function listTickets(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  if (!hasSupportTicketModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'support_ticket_model_unavailable' },
    };
  }

  const scope = await resolveSupportQueueScope(prisma, args.admin);
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  const where = {};
  if (args.tenantId) where.tenantId = String(args.tenantId);
  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status.map((s) => String(s).toUpperCase()) }
      : String(args.status).toUpperCase();
  }

  if (args.myWork) {
    const adminId = args.admin?.id ? String(args.admin.id) : '';
    where.OR = [
      { assigneeAdminId: adminId },
      {
        AND: [
          { assigneeAdminId: null },
          { queueCode: SUPPORT_QUEUE_CODE.GENERAL_SUPPORT },
        ],
      },
    ];
  } else if (args.assigneeAdminId !== undefined && args.assigneeAdminId !== null) {
    where.assigneeAdminId = String(args.assigneeAdminId);
  } else if (args.assigneeAdminId === null) {
    where.assigneeAdminId = null;
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    SUPPORT_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : SUPPORT_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const query = {
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  };
  if (args.cursor) {
    query.cursor = { id: String(args.cursor) };
    query.skip = 1;
  } else if (offset > 0) {
    query.skip = offset;
  }

  let rows = [];
  try {
    rows = await prisma.supportTicket.findMany(query);
  } catch {
    rows = await prisma.supportTicket.findMany({ where, take: limit });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeTicket),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      cursor: args.cursor || null,
      scopeMode: scope.mode,
    },
  };
}

/**
 * Transition ticket status; appends SupportTicketStatusHistory on success.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   ticketId: string,
 *   toStatus: string,
 *   reason?: string,
 *   resolutionCategory?: string,
 *   now?: Date,
 * }} args
 */
export async function transitionTicketStatus(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canTransitionStatus) {
    return { ok: false, forbidden: true, reason: 'support_transition_forbidden' };
  }

  if (!hasSupportTicketModel(prisma)) {
    return { ok: false, error: 'support_ticket_model_unavailable', status: 'UNAVAILABLE' };
  }

  const ticketId = args.ticketId ? String(args.ticketId).trim() : '';
  if (!ticketId) return { ok: false, error: 'ticketId required' };

  let row = null;
  try {
    if (SUPPORT_TICKET_NUMBER_RE.test(ticketId)) {
      row = await prisma.supportTicket.findUnique({ where: { ticketNumber: ticketId } });
    } else {
      row = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    }
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'ticket_not_found' };

  const toStatus = String(args.toStatus || '').trim().toUpperCase();
  const gate = assertTransition(row.status, toStatus, {
    reason: args.reason,
    resolutionCategory: args.resolutionCategory ?? row.resolutionCategory,
  });
  if (!gate.ok) return gate;

  const now = args.now || new Date();
  const data = { status: toStatus, updatedAt: now };

  if (toStatus === SUPPORT_TICKET_STATUS.RESOLVED) {
    data.resolutionCategory = String(args.resolutionCategory).trim();
    data.resolvedAt = now;
  }
  if (toStatus === SUPPORT_TICKET_STATUS.CLOSED) {
    data.closedAt = now;
  }
  if (toStatus === SUPPORT_TICKET_STATUS.REOPENED) {
    data.closedAt = null;
    data.resolvedAt = null;
    data.resolutionCategory = null;
  }

  const updated = await prisma.supportTicket.update({
    where: { id: row.id },
    data,
  });

  await appendStatusHistory(prisma, {
    ticketId: row.id,
    fromStatus: row.status,
    toStatus,
    changedByAdminId: args.admin?.id || null,
    reason: args.reason || null,
    at: now,
  });

  // Wave 3: pause/resume/stop SLA clocks — soft-fail if unavailable
  try {
    await onTicketStatusChangeForSla(prisma, {
      ticketId: row.id,
      fromStatus: row.status,
      toStatus,
      now,
    });
  } catch {
    // never block status transition on SLA
  }

  return { ok: true, ticket: serializeTicket(updated) };
}

export { serializeTicket };
