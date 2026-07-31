/**
 * listCrmActivities — Phase 13 Wave 1.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { hasCrmActivityModel, serializeActivity } from './model.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   type?: string,
 *   status?: string,
 *   ownerAdminId?: string|null,
 *   myWork?: boolean,
 *   primarySubjectType?: string,
 *   primarySubjectId?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listCrmActivities(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canViewAccounts &&
    !access.canViewContacts
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_activity_view_forbidden',
      items: [],
    };
  }

  if (!hasCrmActivityModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_activity_model_unavailable', count: 0 },
    };
  }

  const where = {};
  if (args.type) where.type = String(args.type).trim().toUpperCase();
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.myWork === true && args.admin?.id) {
    where.ownerAdminId = String(args.admin.id);
  } else if (args.ownerAdminId) {
    where.ownerAdminId = String(args.ownerAdminId);
  }
  if (args.primarySubjectType) {
    where.primarySubjectType = String(args.primarySubjectType).trim().toUpperCase();
  }
  if (args.primarySubjectId) {
    where.primarySubjectId = String(args.primarySubjectId).trim();
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  let rows = [];
  try {
    rows = await prisma.crmActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeActivity),
    meta: { count: (rows || []).length, limit, offset },
  };
}
