/**
 * Activity relations — one Activity, many entity projections (no duplicate Activities).
 */

import { CRM_ACTIVITY_RELATION_ROLE, CRM_SUBJECT_TYPES } from '../catalogue.js';
import { hasCrmActivityRelationModel } from './model.js';

const SUBJECT_SET = new Set(CRM_SUBJECT_TYPES);

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   activityId: string,
 *   relatedType: string,
 *   relatedId: string,
 *   role?: string,
 *   now?: Date,
 * }} args
 */
export async function linkActivityRelation(prisma, args = {}) {
  if (!hasCrmActivityRelationModel(prisma)) {
    return { ok: true, skipped: true, reason: 'crm_activity_relation_model_unavailable' };
  }

  const activityId = args.activityId ? String(args.activityId).trim() : '';
  const relatedType = String(args.relatedType || '').trim().toUpperCase();
  const relatedId = args.relatedId ? String(args.relatedId).trim() : '';
  const role = String(args.role || CRM_ACTIVITY_RELATION_ROLE.PRIMARY)
    .trim()
    .toUpperCase();

  if (!activityId || !SUBJECT_SET.has(relatedType) || !relatedId) {
    return { ok: false, error: 'activity_relation_args_required' };
  }

  const now = args.now || new Date();
  try {
    const row = await prisma.crmActivityRelation.create({
      data: {
        activityId,
        relatedType,
        relatedId,
        role,
        createdAt: now,
      },
    });
    return {
      ok: true,
      relation: {
        id: row.id,
        activityId: row.activityId,
        relatedType: row.relatedType,
        relatedId: row.relatedId,
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
export async function listActivityRelations(prisma, args = {}) {
  if (!hasCrmActivityRelationModel(prisma)) {
    return { ok: true, items: [], meta: { unavailable: true } };
  }
  const activityId = args.activityId ? String(args.activityId).trim() : '';
  if (!activityId) return { ok: false, error: 'activityId_required', items: [] };
  try {
    const rows = await prisma.crmActivityRelation.findMany({
      where: { activityId },
    });
    return {
      ok: true,
      items: (rows || []).map((r) => ({
        id: r.id,
        activityId: r.activityId,
        relatedType: r.relatedType,
        relatedId: r.relatedId,
        role: r.role,
      })),
    };
  } catch {
    return { ok: true, items: [] };
  }
}
