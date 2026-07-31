/**
 * Entity Activity projections — Phase 13 Wave 4.
 * Lead / Opportunity (and Account/Contact) panels list Activity projections.
 * One Activity; many entity views — never duplicate Activity rows per panel.
 */

import { CRM_SUBJECT_TYPE } from '../catalogue.js';
import { listCrmActivities } from './list.js';

/**
 * Thin projection for Lead/Opportunity/Account/Contact activity panels.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType: string,
 *   subjectId: string,
 *   limit?: number|string,
 * }} args
 */
export async function listEntityActivityProjections(prisma, args = {}) {
  const subjectType = String(args.subjectType || '')
    .trim()
    .toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';

  const allowed = new Set([
    CRM_SUBJECT_TYPE.LEAD,
    CRM_SUBJECT_TYPE.OPPORTUNITY,
    CRM_SUBJECT_TYPE.ACCOUNT,
    CRM_SUBJECT_TYPE.CONTACT,
  ]);

  if (!allowed.has(subjectType) || !subjectId) {
    return {
      ok: false,
      error: 'subjectType_and_subjectId_required',
      items: [],
    };
  }

  const result = await listCrmActivities(prisma, {
    admin: args.admin,
    primarySubjectType: subjectType,
    primarySubjectId: subjectId,
    limit: args.limit || 30,
  });

  if (!result.ok) return result;

  return {
    ok: true,
    items: (result.items || []).map((a) => ({
      id: a.id,
      activityNumber: a.activityNumber,
      type: a.type,
      status: a.status,
      title: a.title,
      dueAt: a.dueAt,
      completedAt: a.completedAt,
      ownerAdminId: a.ownerAdminId,
      primarySubjectType: a.primarySubjectType,
      primarySubjectId: a.primarySubjectId,
      projection: true,
      duplicateActivityRow: false,
    })),
    meta: {
      ...(result.meta || {}),
      subjectType,
      subjectId,
      oneActivityManyProjections: true,
    },
  };
}
