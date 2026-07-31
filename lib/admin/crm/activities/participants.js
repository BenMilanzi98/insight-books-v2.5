/**
 * Activity participants — Wave 1 minimal (ADMIN / CONTACT roles).
 */

import { hasCrmActivityParticipantModel } from './model.js';

export const CRM_ACTIVITY_PARTICIPANT_TYPE = Object.freeze({
  ADMIN: 'ADMIN',
  CONTACT: 'CONTACT',
});

export const CRM_ACTIVITY_PARTICIPANT_ROLE = Object.freeze({
  OWNER: 'OWNER',
  ASSIGNEE: 'ASSIGNEE',
  ATTENDEE: 'ATTENDEE',
});

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   activityId: string,
 *   participantType: string,
 *   participantId: string,
 *   role?: string,
 *   now?: Date,
 * }} args
 */
export async function addActivityParticipant(prisma, args = {}) {
  if (!hasCrmActivityParticipantModel(prisma)) {
    return { ok: true, skipped: true, reason: 'crm_activity_participant_model_unavailable' };
  }

  const activityId = args.activityId ? String(args.activityId).trim() : '';
  const participantType = String(args.participantType || '').trim().toUpperCase();
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const role = String(args.role || CRM_ACTIVITY_PARTICIPANT_ROLE.ASSIGNEE)
    .trim()
    .toUpperCase();

  if (!activityId || !participantType || !participantId) {
    return { ok: false, error: 'activity_participant_args_required' };
  }

  const now = args.now || new Date();
  try {
    const row = await prisma.crmActivityParticipant.create({
      data: {
        activityId,
        participantType,
        participantId,
        role,
        createdAt: now,
      },
    });
    return {
      ok: true,
      participant: {
        id: row.id,
        activityId: row.activityId,
        participantType: row.participantType,
        participantId: row.participantId,
        role: row.role,
      },
    };
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'P2002') {
      return { ok: true, alreadyLinked: true };
    }
    throw err;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ activityId: string }} args
 */
export async function listActivityParticipants(prisma, args = {}) {
  if (!hasCrmActivityParticipantModel(prisma)) {
    return { ok: true, items: [], meta: { unavailable: true } };
  }
  const activityId = args.activityId ? String(args.activityId).trim() : '';
  if (!activityId) return { ok: false, error: 'activityId_required', items: [] };
  try {
    const rows = await prisma.crmActivityParticipant.findMany({
      where: { activityId },
    });
    return {
      ok: true,
      items: (rows || []).map((r) => ({
        id: r.id,
        activityId: r.activityId,
        participantType: r.participantType,
        participantId: r.participantId,
        role: r.role,
      })),
    };
  } catch {
    return { ok: true, items: [] };
  }
}
