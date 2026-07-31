/**
 * Opportunity-scoped tasks — Phase 12 Wave 3.
 * Uses CrmTask with subjectType OPPORTUNITY. TODO → COMPLETED only.
 * Does not auto-clone Lead tasks.
 */

import {
  CRM_SUBJECT_TYPE,
  CRM_TASK_STATUS,
} from '../catalogue.js';
import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  completeTask as completeCrmTask,
  createTask as createCrmTask,
  hasCrmTaskModel,
  listTasks as listCrmTasks,
} from '../tasks.js';
import { hasCrmOpportunityModel } from './model.js';

async function loadOpportunity(prisma, opportunityId) {
  const id = opportunityId ? String(opportunityId).trim() : '';
  if (!id || !hasCrmOpportunityModel(prisma)) return null;
  try {
    if (/^OPP-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmOpportunity.findUnique({ where: { opportunityNumber: id } });
    }
    return await prisma.crmOpportunity.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, opportunityId: string, title: string, dueAt?: Date|string|null, assigneeAdminId?: string|null, now?: Date }} args
 */
export async function createOpportunityTask(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView) {
    return { ok: false, forbidden: true, reason: 'crm_scope_denied' };
  }

  if (!hasCrmTaskModel(prisma)) {
    return { ok: false, error: 'crm_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  const result = await createCrmTask(prisma, {
    admin: args.admin,
    subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
    subjectId: row.id,
    title: args.title,
    dueAt: args.dueAt,
    assigneeAdminId: args.assigneeAdminId,
    now: args.now,
  });

  return {
    ...result,
    leadTaskCloned: false,
    autoClonedFromLead: false,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, opportunityId: string, status?: string, limit?: number|string, offset?: number|string }} args
 */
export async function listOpportunityTasks(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_view_forbidden', items: [] };
  }

  const row = await loadOpportunity(prisma, args.opportunityId);
  if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found', items: [] };

  return listCrmTasks(prisma, {
    admin: args.admin,
    subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
    subjectId: row.id,
    status: args.status,
    limit: args.limit,
    offset: args.offset,
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, taskId: string, opportunityId?: string, now?: Date }} args
 */
export async function completeOpportunityTask(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_opportunity_edit_forbidden' };
  }

  if (args.opportunityId) {
    const row = await loadOpportunity(prisma, args.opportunityId);
    if (!row) return { ok: false, notFound: true, error: 'opportunity_not_found' };
  }

  return completeCrmTask(prisma, {
    admin: args.admin,
    taskId: args.taskId,
    now: args.now,
  });
}

export { CRM_TASK_STATUS, CRM_SUBJECT_TYPE };
