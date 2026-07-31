/**

 * Support ticket assignment + history (Phase 10 Wave 2).

 * Same assignee + same queue → noop (no history spam).

 * Status moves to ASSIGNED only via state machine when transition is allowed.

 */



import { SUPPORT_TICKET_STATUS, SUPPORT_QUEUE_CODES } from './catalogue.js';

import { resolveSupportAccess } from './authz.js';

import { canTransition, assertTransition } from './stateMachine.js';

import { findSupportTicket } from './ticketLookup.js';

import { serializeTicket } from './tickets.js';

import { isEligibleAssignee } from './teams.js';



const QUEUE_SET = new Set(SUPPORT_QUEUE_CODES);



export function hasSupportAssignmentHistoryModel(prisma) {

  return typeof prisma?.supportAssignmentHistory?.create === 'function';

}



function serializeAssignmentHistory(row) {

  if (!row) return null;

  return {

    id: row.id,

    ticketId: row.ticketId,

    fromAssigneeAdminId: row.fromAssigneeAdminId || null,

    toAssigneeAdminId: row.toAssigneeAdminId || null,

    fromQueueCode: row.fromQueueCode || null,

    toQueueCode: row.toQueueCode || null,

    changedByAdminId: row.changedByAdminId || null,

    reason: row.reason || null,

    at: row.at ? new Date(row.at).toISOString() : null,

  };

}



async function appendAssignmentHistory(prisma, data) {

  if (!hasSupportAssignmentHistoryModel(prisma)) return null;

  return prisma.supportAssignmentHistory.create({ data });

}



async function appendStatusHistory(prisma, data) {

  if (typeof prisma.supportTicketStatusHistory?.create !== 'function') return null;

  return prisma.supportTicketStatusHistory.create({ data });

}



/**

 * Assign / reassign a ticket.

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{

 *   admin: object,

 *   ticketId: string,

 *   assigneeAdminId: string,

 *   queueCode?: string|null,

 *   reason?: string|null,

 *   now?: Date,

 * }} args

 */

export async function assignTicket(prisma, args = {}) {

  const access = resolveSupportAccess(args.admin);

  if (!access.canAssignTickets) {

    return { ok: false, forbidden: true, reason: 'support_assign_forbidden' };

  }



  if (typeof prisma?.supportTicket?.update !== 'function') {

    return { ok: false, error: 'support_ticket_model_unavailable', status: 'UNAVAILABLE' };

  }



  const ticketId = args.ticketId ? String(args.ticketId).trim() : '';

  const assigneeAdminId = args.assigneeAdminId ? String(args.assigneeAdminId).trim() : '';

  if (!ticketId) return { ok: false, error: 'ticketId_required' };

  if (!assigneeAdminId) return { ok: false, error: 'assigneeAdminId_required' };



  let queueCode =

    args.queueCode != null && String(args.queueCode).trim() !== ''

      ? String(args.queueCode).trim().toUpperCase()

      : null;



  if (queueCode && !QUEUE_SET.has(queueCode)) {

    return { ok: false, error: 'invalid_queue_code', queueCode };

  }



  const ticket = await findSupportTicket(prisma, ticketId);

  if (!ticket) return { ok: false, notFound: true, error: 'ticket_not_found' };



  // When queue omitted on reassign, keep existing queue for noop comparison

  if (queueCode == null) {

    queueCode = ticket.queueCode || null;

  }



  const eligibility = await isEligibleAssignee(prisma, {

    adminId: assigneeAdminId,

    queueCode,

  });

  if (!eligibility.eligible) {

    return { ok: false, error: 'assignee_not_eligible', reason: eligibility.reason };

  }



  const sameAssignee = (ticket.assigneeAdminId || null) === assigneeAdminId;

  const sameQueue = (ticket.queueCode || null) === (queueCode || null);

  if (sameAssignee && sameQueue) {

    return {

      ok: true,

      noop: true,

      ticket: serializeTicket(ticket),

    };

  }



  const now = args.now || new Date();

  const fromAssignee = ticket.assigneeAdminId || null;

  const fromQueue = ticket.queueCode || null;



  const data = {

    assigneeAdminId,

    queueCode: queueCode || null,

    updatedAt: now,

  };



  // Optionally move toward ASSIGNED when state machine allows (never bypass)

  let statusTransitioned = false;

  if (

    ticket.status !== SUPPORT_TICKET_STATUS.ASSIGNED &&

    canTransition(ticket.status, SUPPORT_TICKET_STATUS.ASSIGNED)

  ) {

    const gate = assertTransition(ticket.status, SUPPORT_TICKET_STATUS.ASSIGNED, {

      reason: args.reason,

    });

    if (gate.ok) {

      data.status = SUPPORT_TICKET_STATUS.ASSIGNED;

      statusTransitioned = true;

    }

  }



  const updated = await prisma.supportTicket.update({

    where: { id: ticket.id },

    data,

  });



  await appendAssignmentHistory(prisma, {

    ticketId: ticket.id,

    fromAssigneeAdminId: fromAssignee,

    toAssigneeAdminId: assigneeAdminId,

    fromQueueCode: fromQueue,

    toQueueCode: queueCode || null,

    changedByAdminId: args.admin?.id || null,

    reason: args.reason != null ? String(args.reason) : null,

    at: now,

  });



  if (statusTransitioned) {

    await appendStatusHistory(prisma, {

      ticketId: ticket.id,

      fromStatus: ticket.status,

      toStatus: SUPPORT_TICKET_STATUS.ASSIGNED,

      changedByAdminId: args.admin?.id || null,

      reason: args.reason || 'assigned',

      at: now,

    });

  }



  return {

    ok: true,

    noop: false,

    ticket: serializeTicket(updated),

    assignmentHistory: serializeAssignmentHistory({

      ticketId: ticket.id,

      fromAssigneeAdminId: fromAssignee,

      toAssigneeAdminId: assigneeAdminId,

      fromQueueCode: fromQueue,

      toQueueCode: queueCode || null,

      changedByAdminId: args.admin?.id || null,

      reason: args.reason != null ? String(args.reason) : null,

      at: now,

    }),

  };

}



export { serializeAssignmentHistory };


