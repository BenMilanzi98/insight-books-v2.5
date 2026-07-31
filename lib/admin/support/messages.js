/**
 * Support messages — public reply / internal / restricted notes (Phase 10 Wave 2).
 * Enforcement is API/service-layer — never CSS-only.
 * projectForCustomer never includes INTERNAL_NOTE or RESTRICTED_INTERNAL_NOTE.
 * Wave 3: first PUBLIC_AGENT_REPLY stops FIRST_RESPONSE SLA clock.
 */

import {
  SUPPORT_MESSAGE_TYPE,
  SUPPORT_CUSTOMER_VISIBLE_MESSAGE_TYPES,
  SUPPORT_CUSTOMER_SAFE_SYSTEM_EVENT_CODES,
} from './catalogue.js';
import { resolveSupportAccess } from './authz.js';
import { findSupportTicket } from './ticketLookup.js';
import { stopFirstResponseOnPublicReply } from './sla/index.js';

export function hasSupportMessageModel(prisma) {
  return typeof prisma?.supportMessage?.create === 'function';
}

function serializeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticketId,
    type: row.type,
    body: row.body,
    authorAdminId: row.authorAdminId || null,
    visibility: row.visibility || null,
    systemEventCode: row.systemEventCode || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * Customer portal projection (portal deferred). Fail closed on internal/restricted.
 *
 * @param {Array<object>} messages — already-serialized or raw rows
 * @returns {Array<object>}
 */
export function projectForCustomer(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const safeSystem = new Set(SUPPORT_CUSTOMER_SAFE_SYSTEM_EVENT_CODES);
  return list
    .filter((m) => {
      const type = String(m?.type || '');
      if (
        type === SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE ||
        type === SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE
      ) {
        return false;
      }
      if (type === SUPPORT_MESSAGE_TYPE.SYSTEM_EVENT) {
        return safeSystem.has(String(m?.systemEventCode || ''));
      }
      return SUPPORT_CUSTOMER_VISIBLE_MESSAGE_TYPES.includes(type);
    })
    .map((m) => serializeMessage(m));
}

/**
 * Message types visible to this admin in agent list view.
 * @param {ReturnType<typeof resolveSupportAccess>} access
 */
export function visibleMessageTypesForAdmin(access) {
  const types = [
    SUPPORT_MESSAGE_TYPE.CUSTOMER_MESSAGE,
    SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY,
    SUPPORT_MESSAGE_TYPE.SYSTEM_EVENT,
  ];
  if (access.canAddInternalNotes || access.isSuperAdmin) {
    types.push(SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE);
  }
  if (access.canViewRestrictedNotes || access.isSuperAdmin) {
    types.push(SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE);
  }
  return types;
}

async function createMessage(prisma, { admin, ticketId, type, body, visibility, systemEventCode }) {
  const access = resolveSupportAccess(admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden' };
  }

  const text = body != null ? String(body).trim() : '';
  if (!text) return { ok: false, error: 'body_required' };

  if (!hasSupportMessageModel(prisma)) {
    return { ok: false, error: 'support_message_model_unavailable', status: 'UNAVAILABLE' };
  }

  const ticket = await findSupportTicket(prisma, ticketId);
  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found' };

  const now = new Date();
  const row = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      type,
      body: text,
      authorAdminId: admin?.id || null,
      visibility: visibility || null,
      systemEventCode: systemEventCode || null,
      createdAt: now,
    },
  });

  return { ok: true, message: serializeMessage(row) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string, body: string, now?: Date }} args
 */
export async function addPublicReply(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canReplyPublicly) {
    return { ok: false, forbidden: true, reason: 'support_reply_public_forbidden' };
  }

  const result = await createMessage(prisma, {
    admin: args.admin,
    ticketId: args.ticketId,
    type: SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY,
    body: args.body,
    visibility: 'PUBLIC',
  });

  if (result.ok) {
    try {
      await stopFirstResponseOnPublicReply(prisma, {
        ticketId: result.message?.ticketId || args.ticketId,
        messageType: SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY,
        now: args.now || new Date(),
      });
    } catch {
      // never block public reply on SLA
    }
  }

  return result;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string, body: string }} args
 */
export async function addInternalNote(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canAddInternalNotes) {
    return { ok: false, forbidden: true, reason: 'support_internal_note_forbidden' };
  }
  return createMessage(prisma, {
    admin: args.admin,
    ticketId: args.ticketId,
    type: SUPPORT_MESSAGE_TYPE.INTERNAL_NOTE,
    body: args.body,
    visibility: 'INTERNAL',
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string, body: string }} args
 */
export async function addRestrictedNote(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canAddRestrictedNotes) {
    return { ok: false, forbidden: true, reason: 'support_restricted_note_forbidden' };
  }
  return createMessage(prisma, {
    admin: args.admin,
    ticketId: args.ticketId,
    type: SUPPORT_MESSAGE_TYPE.RESTRICTED_INTERNAL_NOTE,
    body: args.body,
    visibility: 'RESTRICTED',
  });
}

/**
 * List messages for admin agent view (permission-filtered).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, ticketId: string }} args
 */
export async function listMessages(prisma, args = {}) {
  const access = resolveSupportAccess(args.admin);
  if (!access.canViewTickets) {
    return { ok: false, forbidden: true, reason: 'support_view_forbidden', items: [] };
  }

  if (!hasSupportMessageModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'support_message_model_unavailable' },
    };
  }

  const ticket = await findSupportTicket(prisma, args.ticketId);
  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found', items: [] };

  const allowedTypes = visibleMessageTypesForAdmin(access);
  let rows = [];
  try {
    rows = await prisma.supportMessage.findMany({
      where: {
        ticketId: ticket.id,
        type: { in: allowedTypes },
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeMessage),
    meta: { count: (rows || []).length, ticketId: ticket.id },
  };
}

export { serializeMessage };
