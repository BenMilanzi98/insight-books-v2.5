/**
 * Expansion handoffs — record-only. No CRM opportunity, no auto plan upgrade,
 * no AccountSubscription mutation.
 */

import { CS_HANDOFF_ACTION, CS_HANDOFF_STATUS } from './catalogue.js';
import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';

function hasCsHandoffModel(prisma) {
  return typeof prisma?.csExpansionHandoff?.findMany === 'function';
}

function serializeHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status,
    reason: row.reason || null,
    notes: row.notes || null,
    recommendedAction: row.recommendedAction || CS_HANDOFF_ACTION.OTHER,
    createdByAdminId: row.createdByAdminId || null,
    payload: row.payload || null,
    recordOnly: true,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Create an expansion handoff record. Never upgrades subscriptions or opens CRM opps.
 */
export async function createExpansionHandoff(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageCases) {
    return { ok: false, forbidden: true, reason: 'manage_cases_required' };
  }

  if (!hasCsHandoffModel(prisma)) {
    return { ok: false, error: 'cs_handoff_model_unavailable', status: 'UNAVAILABLE' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  if (!tenantId) return { ok: false, error: 'tenantId required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  const action = args.recommendedAction
    ? String(args.recommendedAction).trim().toUpperCase()
    : CS_HANDOFF_ACTION.OTHER;
  const allowed = new Set(Object.values(CS_HANDOFF_ACTION));
  const recommendedAction = allowed.has(action) ? action : CS_HANDOFF_ACTION.OTHER;

  const row = await prisma.csExpansionHandoff.create({
    data: {
      tenantId,
      status: args.status || CS_HANDOFF_STATUS.OPEN,
      reason: args.reason ? String(args.reason).trim() : null,
      notes: args.notes ? String(args.notes) : null,
      recommendedAction,
      createdByAdminId: args.admin?.id || null,
      payload: args.payload && typeof args.payload === 'object' ? args.payload : null,
    },
  });

  return {
    ok: true,
    created: true,
    handoff: serializeHandoff(row),
    meta: {
      recordOnly: true,
      mutatesSubscription: false,
      createsCrmOpportunity: false,
    },
  };
}

export async function listExpansionHandoffs(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasCsHandoffModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_handoff_model_unavailable' },
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
    rows = await prisma.csExpansionHandoff.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, Number(args.limit) || 50)),
    });
  } catch {
    rows = await prisma.csExpansionHandoff.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeHandoff),
    meta: {
      count: (rows || []).length,
      scopeMode: scope.mode,
      recordOnly: true,
    },
  };
}

export { serializeHandoff, hasCsHandoffModel };
