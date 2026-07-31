/**
 * CS playbooks — versioned definitions; execution expands steps → CsTask deterministically.
 * Idempotent per playbookKey+version+tenant+case. Never mutates source facts.
 */

import {
  CS_PLAYBOOK_EXECUTION_STATUS,
  CS_PLAYBOOK_STATUS,
  CS_TASK_STATUS,
  playbookExecutionIdempotencyKey,
  playbookStepTaskIdempotencyKey,
} from './catalogue.js';
import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';
import { getCase } from './cases.js';
import { createTask, hasCsTaskModel } from './tasks.js';

function hasCsPlaybookModel(prisma) {
  return typeof prisma?.csPlaybook?.findMany === 'function';
}

function hasCsExecutionModel(prisma) {
  return typeof prisma?.csPlaybookExecution?.findMany === 'function';
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s, idx) => {
      const stepId = s?.stepId ? String(s.stepId).trim() : `step-${idx + 1}`;
      const title = s?.title ? String(s.title).trim() : '';
      if (!stepId || !title) return null;
      return {
        stepId,
        title,
        dueOffsetDays:
          s?.dueOffsetDays != null && Number.isFinite(Number(s.dueOffsetDays))
            ? Number(s.dueOffsetDays)
            : null,
        notes: s?.notes ? String(s.notes) : null,
      };
    })
    .filter(Boolean);
}

function serializePlaybook(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    version: row.version,
    description: row.description || null,
    status: row.status,
    steps: Array.isArray(row.steps) ? row.steps : [],
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function serializeExecution(row) {
  if (!row) return null;
  return {
    id: row.id,
    playbookId: row.playbookId,
    tenantId: row.tenantId,
    caseId: row.caseId || null,
    status: row.status,
    playbookVersion: row.playbookVersion,
    idempotencyKey: row.idempotencyKey || null,
    startedByAdminId: row.startedByAdminId || null,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Create a versioned playbook definition.
 */
export async function createPlaybook(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsPlaybookModel(prisma)) {
    return { ok: false, error: 'cs_playbook_model_unavailable', status: 'UNAVAILABLE' };
  }

  const key = args.key ? String(args.key).trim() : '';
  const name = args.name ? String(args.name).trim() : '';
  const version = args.version ? String(args.version).trim() : '1';
  const steps = normalizeSteps(args.steps);

  if (!key) return { ok: false, error: 'key required' };
  if (!name) return { ok: false, error: 'name required' };
  if (!steps.length) return { ok: false, error: 'steps required' };

  if (typeof prisma.csPlaybook.findUnique === 'function') {
    try {
      const existing = await prisma.csPlaybook.findUnique({
        where: { key_version: { key, version } },
      });
      if (existing) {
        return {
          ok: true,
          created: false,
          noop: true,
          playbook: serializePlaybook(existing),
        };
      }
    } catch {
      // fall through
    }
  }

  const row = await prisma.csPlaybook.create({
    data: {
      key,
      name,
      version,
      description: args.description ? String(args.description) : null,
      status: args.status || CS_PLAYBOOK_STATUS.ACTIVE,
      steps,
    },
  });

  return { ok: true, created: true, playbook: serializePlaybook(row) };
}

export async function listPlaybooks(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsPlaybookModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_playbook_model_unavailable' },
    };
  }

  const where = {};
  if (args.status) where.status = String(args.status);
  else where.status = CS_PLAYBOOK_STATUS.ACTIVE;

  let rows = [];
  try {
    rows = await prisma.csPlaybook.findMany({
      where,
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      take: Math.min(200, Math.max(1, Number(args.limit) || 50)),
    });
  } catch {
    rows = await prisma.csPlaybook.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializePlaybook),
    meta: { count: (rows || []).length },
  };
}

async function loadTasksForExecution(prisma, admin, executionId, now) {
  if (!hasCsTaskModel(prisma)) return [];
  try {
    const rows = await prisma.csTask.findMany({
      where: { executionId: String(executionId) },
      orderBy: { createdAt: 'asc' },
    });
    return (rows || []).map((row) => ({
      id: row.id,
      caseId: row.caseId || null,
      tenantId: row.tenantId,
      title: row.title,
      status: row.status,
      stepId: row.stepId || null,
      executionId: row.executionId || null,
      idempotencyKey: row.idempotencyKey || null,
      dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Execute a playbook for a tenant (optional case). Creates one task per definition step.
 */
export async function executePlaybook(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsPlaybookModel(prisma) || !hasCsExecutionModel(prisma)) {
    return { ok: false, error: 'cs_playbook_model_unavailable', status: 'UNAVAILABLE' };
  }

  const playbookId = args.playbookId ? String(args.playbookId) : '';
  const tenantId = args.tenantId ? String(args.tenantId) : '';
  if (!playbookId) return { ok: false, error: 'playbookId required' };
  if (!tenantId) return { ok: false, error: 'tenantId required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  let playbook = null;
  try {
    playbook = await prisma.csPlaybook.findUnique({ where: { id: playbookId } });
  } catch {
    playbook = await prisma.csPlaybook.findFirst({ where: { id: playbookId } });
  }
  if (!playbook) return { ok: false, notFound: true, error: 'playbook_not_found' };

  const steps = normalizeSteps(playbook.steps);
  if (!steps.length) return { ok: false, error: 'playbook_has_no_steps' };

  const caseId = args.caseId ? String(args.caseId) : null;

  // Fail closed: verify case exists and belongs to execution tenant before work.
  if (caseId) {
    const caseResult = await getCase(prisma, {
      admin: args.admin,
      caseId,
      now: args.now,
    });
    if (!caseResult.ok) return caseResult;
    if (caseResult.case.tenantId !== tenantId) {
      return { ok: false, error: 'case_tenant_mismatch' };
    }
  }

  const execKey = playbookExecutionIdempotencyKey({
    playbookKey: playbook.key,
    playbookVersion: playbook.version,
    tenantId,
    caseId,
  });

  let execution = null;
  let created = false;

  try {
    execution = await prisma.csPlaybookExecution.findFirst({
      where: { idempotencyKey: execKey },
    });
  } catch {
    execution = null;
  }

  if (!execution) {
    try {
      execution = await prisma.csPlaybookExecution.create({
        data: {
          playbookId: playbook.id,
          tenantId,
          caseId,
          status: CS_PLAYBOOK_EXECUTION_STATUS.RUNNING,
          playbookVersion: playbook.version,
          idempotencyKey: execKey,
          startedByAdminId: args.admin?.id || null,
          startedAt: args.now ? new Date(args.now) : new Date(),
        },
      });
      created = true;
    } catch (err) {
      if (err && err.code === 'P2002') {
        execution = await prisma.csPlaybookExecution.findFirst({
          where: { idempotencyKey: execKey },
        });
        created = false;
      } else {
        throw err;
      }
    }
  }

  if (!execution) {
    return { ok: false, error: 'execution_create_failed' };
  }

  const now = args.now ? new Date(args.now) : new Date();
  const tasks = [];

  for (const step of steps) {
    const taskKey = playbookStepTaskIdempotencyKey(execution.id, step.stepId);
    let dueAt = null;
    if (step.dueOffsetDays != null) {
      dueAt = new Date(now.getTime() + step.dueOffsetDays * 864e5);
    }

    const taskResult = await createTask(prisma, {
      admin: args.admin,
      tenantId,
      caseId,
      title: step.title,
      status: CS_TASK_STATUS.OPEN,
      stepId: step.stepId,
      executionId: execution.id,
      idempotencyKey: taskKey,
      dueAt,
      notes: step.notes,
      now,
    });

    if (!taskResult.ok) {
      // Leave RUNNING — never mark COMPLETED on partial/failed task creation.
      return {
        ok: false,
        error: taskResult.error || taskResult.reason || 'task_create_failed',
        forbidden: taskResult.forbidden,
        notFound: taskResult.notFound,
        status: taskResult.status,
        reason: taskResult.reason,
        execution: serializeExecution(execution),
        tasks,
      };
    }

    if (taskResult.task) {
      tasks.push(taskResult.task);
    }
  }

  if (tasks.length !== steps.length) {
    return {
      ok: false,
      error: 'incomplete_task_creation',
      execution: serializeExecution(execution),
      tasks,
    };
  }

  if (created || execution.status === CS_PLAYBOOK_EXECUTION_STATUS.RUNNING) {
    try {
      execution = await prisma.csPlaybookExecution.update({
        where: { id: execution.id },
        data: {
          status: CS_PLAYBOOK_EXECUTION_STATUS.COMPLETED,
          completedAt: now,
        },
      });
    } catch {
      // keep prior execution row
    }
  }

  return {
    ok: true,
    created,
    noop: !created,
    idempotent: !created,
    execution: serializeExecution(execution),
    playbook: serializePlaybook(playbook),
    tasks,
  };
}

export async function listPlaybookExecutions(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsExecutionModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_playbook_model_unavailable' },
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

  if (args.playbookId) where.playbookId = String(args.playbookId);

  let rows = [];
  try {
    rows = await prisma.csPlaybookExecution.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: Math.min(200, Math.max(1, Number(args.limit) || 50)),
    });
  } catch {
    rows = await prisma.csPlaybookExecution.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeExecution),
    meta: { count: (rows || []).length, scopeMode: scope.mode },
  };
}

export {
  serializePlaybook,
  serializeExecution,
  hasCsPlaybookModel,
  hasCsExecutionModel,
  normalizeSteps,
};
