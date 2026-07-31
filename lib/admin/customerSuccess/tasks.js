/**
 * CS tasks — linked to cases / playbook steps. Portfolio-scoped.
 */

import { CS_TASK_STATUS } from './catalogue.js';
import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';
import { getCase } from './cases.js';

function hasCsTaskModel(prisma) {
  return typeof prisma?.csTask?.findMany === 'function';
}

function serializeTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.caseId || null,
    tenantId: row.tenantId,
    title: row.title,
    status: row.status,
    assigneeAdminId: row.assigneeAdminId || null,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    stepId: row.stepId || null,
    executionId: row.executionId || null,
    idempotencyKey: row.idempotencyKey || null,
    notes: row.notes || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Create a task on a case (or standalone tenant task).
 */
export async function createTask(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const title = args.title ? String(args.title).trim() : '';
  if (!title) return { ok: false, error: 'title required' };

  let tenantId = args.tenantId ? String(args.tenantId) : '';
  if (args.caseId) {
    const c = await getCase(prisma, {
      admin: args.admin,
      caseId: args.caseId,
      now: args.now,
    });
    if (!c.ok) return c;
    if (tenantId && c.case.tenantId !== tenantId) {
      return { ok: false, error: 'case_tenant_mismatch' };
    }
    if (!tenantId) tenantId = c.case.tenantId;
  }

  if (!tenantId) return { ok: false, error: 'tenantId or caseId required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasCsTaskModel(prisma)) {
    return { ok: false, error: 'cs_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  if (args.idempotencyKey && typeof prisma.csTask.findFirst === 'function') {
    try {
      const existing = await prisma.csTask.findFirst({
        where: { idempotencyKey: String(args.idempotencyKey) },
      });
      if (existing) {
        return {
          ok: true,
          created: false,
          noop: true,
          idempotent: true,
          task: serializeTask(existing),
        };
      }
    } catch {
      // continue
    }
  }

  const row = await prisma.csTask.create({
    data: {
      caseId: args.caseId || null,
      tenantId,
      title,
      status: args.status || CS_TASK_STATUS.OPEN,
      assigneeAdminId: args.assigneeAdminId || null,
      dueAt: args.dueAt ? new Date(args.dueAt) : null,
      stepId: args.stepId || null,
      executionId: args.executionId || null,
      idempotencyKey: args.idempotencyKey || null,
      notes: args.notes || null,
      createdByAdminId: args.admin?.id || null,
    },
  });

  return { ok: true, created: true, task: serializeTask(row) };
}

export async function listTasks(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsTaskModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_task_model_unavailable' },
    };
  }

  const scope = await resolveCsPortfolioScope(prisma, args.admin, { now: args.now });
  const tenantFilter = csTenantIdFilter(scope);
  const where = {};

  if (args.tenantId) {
    const gate = await assertCsTenantAccess(prisma, args.admin, args.tenantId, {
      now: args.now,
    });
    if (!gate.ok) {
      return { ok: false, forbidden: true, reason: gate.reason, items: [] };
    }
    where.tenantId = String(args.tenantId);
  } else if (tenantFilter) {
    where.tenantId = tenantFilter;
  }

  if (args.caseId) where.caseId = String(args.caseId);
  if (args.status) {
    where.status = Array.isArray(args.status)
      ? { in: args.status }
      : String(args.status);
  }
  if (args.assigneeAdminId) where.assigneeAdminId = String(args.assigneeAdminId);

  const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.csTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = await prisma.csTask.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeTask),
    meta: { count: (rows || []).length, scopeMode: scope.mode, limit },
  };
}

export async function updateTask(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsTaskModel(prisma) || typeof prisma.csTask.findUnique !== 'function') {
    return { ok: false, error: 'cs_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  const taskId = args.taskId ? String(args.taskId) : '';
  if (!taskId) return { ok: false, error: 'taskId required' };

  let row = null;
  try {
    row = await prisma.csTask.findUnique({ where: { id: taskId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'task_not_found' };

  const gate = await assertCsTenantAccess(prisma, args.admin, row.tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason };
  }

  const data = {};
  if (args.status) data.status = String(args.status);
  if (args.assigneeAdminId !== undefined) {
    data.assigneeAdminId = args.assigneeAdminId || null;
  }
  if (args.title) data.title = String(args.title);
  if (args.notes !== undefined) data.notes = args.notes;
  if (args.dueAt !== undefined) {
    data.dueAt = args.dueAt ? new Date(args.dueAt) : null;
  }

  const updated = await prisma.csTask.update({ where: { id: taskId }, data });
  return { ok: true, task: serializeTask(updated) };
}

export { serializeTask, hasCsTaskModel };
