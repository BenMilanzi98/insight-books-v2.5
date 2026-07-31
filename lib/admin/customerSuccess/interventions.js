/**
 * CS interventions — agent-logged actions. Never invents support tickets.
 */

import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';
import { getCase } from './cases.js';

function hasCsInterventionModel(prisma) {
  return typeof prisma?.csIntervention?.findMany === 'function';
}

function serializeIntervention(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.caseId || null,
    tenantId: row.tenantId,
    type: row.type,
    notes: row.notes || null,
    channel: row.channel || null,
    performedByAdminId: row.performedByAdminId || null,
    performedAt: row.performedAt
      ? new Date(row.performedAt).toISOString()
      : null,
    payload: row.payload || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * Log an intervention (call, email note, meeting, etc.). Not a support ticket.
 */
export async function logIntervention(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  const type = args.type ? String(args.type).trim() : '';
  if (!type) return { ok: false, error: 'type required' };

  let tenantId = args.tenantId ? String(args.tenantId) : '';
  if (args.caseId) {
    const c = await getCase(prisma, {
      admin: args.admin,
      caseId: args.caseId,
      now: args.now,
    });
    if (!c.ok) return c;
    tenantId = c.case.tenantId;
  }

  if (!tenantId) return { ok: false, error: 'tenantId or caseId required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasCsInterventionModel(prisma)) {
    return {
      ok: false,
      error: 'cs_intervention_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const row = await prisma.csIntervention.create({
    data: {
      caseId: args.caseId || null,
      tenantId,
      type,
      notes: args.notes || null,
      channel: args.channel || null,
      performedByAdminId: args.admin?.id || null,
      performedAt: args.performedAt ? new Date(args.performedAt) : new Date(),
      payload: {
        ...(args.payload && typeof args.payload === 'object' ? args.payload : {}),
        notSupportTicket: true,
      },
    },
  });

  return { ok: true, created: true, intervention: serializeIntervention(row) };
}

export async function listInterventions(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsInterventionModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_intervention_model_unavailable' },
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

  const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.csIntervention.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = await prisma.csIntervention.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeIntervention),
    meta: { count: (rows || []).length, scopeMode: scope.mode, limit },
  };
}

export { serializeIntervention, hasCsInterventionModel };
