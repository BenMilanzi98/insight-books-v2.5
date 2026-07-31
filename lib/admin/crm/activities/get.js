/**
 * getCrmActivity — Phase 13 Wave 1.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmActivityModel, serializeActivity } from './model.js';
import { listActivityRelations } from './relations.js';
import { listActivityParticipants } from './participants.js';
import { CRM_ACTIVITY_NUMBER_RE } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, activityId?: string, activityNumber?: string }} args
 */
export async function getCrmActivity(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canViewAccounts &&
    !access.canViewContacts
  ) {
    return { ok: false, forbidden: true, reason: 'crm_activity_view_forbidden' };
  }

  if (!hasCrmActivityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const activityId = args.activityId ? String(args.activityId).trim() : '';
  const activityNumber = args.activityNumber
    ? String(args.activityNumber).trim().toUpperCase()
    : '';

  let row = null;
  try {
    if (activityId) {
      row = await prisma.crmActivity.findUnique({ where: { id: activityId } });
    } else if (activityNumber && CRM_ACTIVITY_NUMBER_RE.test(activityNumber)) {
      row = await prisma.crmActivity.findUnique({
        where: { activityNumber },
      });
    }
  } catch {
    row = null;
  }

  if (!row) {
    return { ok: false, notFound: true, error: 'activity_not_found' };
  }

  const relations = await listActivityRelations(prisma, { activityId: row.id });
  const participants = await listActivityParticipants(prisma, {
    activityId: row.id,
  });

  return {
    ok: true,
    activity: serializeActivity(row),
    relations: relations.items || [],
    participants: participants.items || [],
  };
}
