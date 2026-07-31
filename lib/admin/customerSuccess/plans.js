/**
 * CS success plans + goals — agent-created outcomes tracking (no invented progress %).
 */

import { CS_SUCCESS_GOAL_STATUS, CS_SUCCESS_PLAN_STATUS } from './catalogue.js';
import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';

function hasCsPlanModel(prisma) {
  return typeof prisma?.csSuccessPlan?.findMany === 'function';
}

function hasCsGoalModel(prisma) {
  return typeof prisma?.csSuccessGoal?.findMany === 'function';
}

function serializePlan(row, goals = null) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    status: row.status,
    summary: row.summary || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    adoptionPlanId: row.adoptionPlanId || null,
    migrationStatus: row.migrationStatus || null,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    targetAt: row.targetAt ? new Date(row.targetAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    goals: goals != null ? goals.map(serializeGoal) : undefined,
  };
}

function serializeGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId,
    title: row.title,
    status: row.status,
    targetNote: row.targetNote || null,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function createSuccessPlan(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsPlanModel(prisma)) {
    return { ok: false, error: 'cs_plan_model_unavailable', status: 'UNAVAILABLE' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const title = args.title ? String(args.title).trim() : '';
  if (!tenantId) return { ok: false, error: 'tenantId required' };
  if (!title) return { ok: false, error: 'title required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  const row = await prisma.csSuccessPlan.create({
    data: {
      tenantId,
      title,
      status: args.status || CS_SUCCESS_PLAN_STATUS.ACTIVE,
      summary: args.summary ? String(args.summary) : null,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      startedAt: args.startedAt ? new Date(args.startedAt) : new Date(),
      targetAt: args.targetAt ? new Date(args.targetAt) : null,
    },
  });

  const goals = [];
  if (Array.isArray(args.goals) && hasCsGoalModel(prisma)) {
    for (let i = 0; i < args.goals.length; i++) {
      const g = args.goals[i];
      const gTitle = g?.title ? String(g.title).trim() : '';
      if (!gTitle) continue;
      const goal = await prisma.csSuccessGoal.create({
        data: {
          planId: row.id,
          title: gTitle,
          status: g.status || CS_SUCCESS_GOAL_STATUS.OPEN,
          targetNote: g.targetNote ? String(g.targetNote) : null,
          dueAt: g.dueAt ? new Date(g.dueAt) : null,
          sortOrder: g.sortOrder != null ? Number(g.sortOrder) : i,
        },
      });
      goals.push(goal);
    }
  }

  return { ok: true, created: true, plan: serializePlan(row, goals) };
}

export async function listSuccessPlans(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsPlanModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_plan_model_unavailable' },
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

  if (args.status) where.status = String(args.status);

  let rows = [];
  try {
    rows = await prisma.csSuccessPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, Number(args.limit) || 50)),
    });
  } catch {
    rows = await prisma.csSuccessPlan.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map((r) => serializePlan(r)),
    meta: { count: (rows || []).length, scopeMode: scope.mode },
  };
}

export async function addSuccessGoal(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsPlanModel(prisma) || !hasCsGoalModel(prisma)) {
    return { ok: false, error: 'cs_plan_model_unavailable', status: 'UNAVAILABLE' };
  }

  const planId = args.planId ? String(args.planId) : '';
  const title = args.title ? String(args.title).trim() : '';
  if (!planId) return { ok: false, error: 'planId required' };
  if (!title) return { ok: false, error: 'title required' };

  let plan = null;
  try {
    plan = await prisma.csSuccessPlan.findUnique({ where: { id: planId } });
  } catch {
    plan = null;
  }
  if (!plan) return { ok: false, notFound: true, error: 'plan_not_found' };

  const gate = await assertCsTenantAccess(prisma, args.admin, plan.tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason };
  }

  const goal = await prisma.csSuccessGoal.create({
    data: {
      planId,
      title,
      status: args.status || CS_SUCCESS_GOAL_STATUS.OPEN,
      targetNote: args.targetNote ? String(args.targetNote) : null,
      dueAt: args.dueAt ? new Date(args.dueAt) : null,
      sortOrder: args.sortOrder != null ? Number(args.sortOrder) : 0,
    },
  });

  return { ok: true, created: true, goal: serializeGoal(goal) };
}

export { serializePlan, serializeGoal, hasCsPlanModel, hasCsGoalModel };
