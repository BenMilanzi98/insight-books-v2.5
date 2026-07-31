/**
 * CS renewal workspaces — outcome writes gated by AccountSubscription evidence.
 * Never mutates subscription rows; only reads them as evidence.
 */

import {
  CS_RENEWAL_OUTCOME,
  CS_RENEWAL_STATUS,
} from './catalogue.js';
import {
  assertCsTenantAccess,
  csTenantIdFilter,
  resolveCsAccess,
  resolveCsPortfolioScope,
} from './authz.js';

function hasRenewalModel(prisma) {
  return typeof prisma?.csRenewalWorkspace?.findMany === 'function';
}

function serializeWorkspace(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    periodKey: row.periodKey,
    status: row.status,
    outcome: row.outcome || null,
    outcomeAt: row.outcomeAt ? new Date(row.outcomeAt).toISOString() : null,
    outcomeByAdminId: row.outcomeByAdminId || null,
    subscriptionId: row.subscriptionId || null,
    evidenceNote: row.evidenceNote || null,
    notes: row.notes || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function isActiveCompletedStatus(status) {
  const s = String(status || '').toUpperCase();
  return (
    s === 'COMPLETED' ||
    s === 'ACTIVE' ||
    s === 'PAID' ||
    s === 'SUCCESS' ||
    s === 'SUCCEEDED'
  );
}

function isChurnEvidenceStatus(status) {
  const s = String(status || '').toUpperCase();
  return (
    s === 'EXPIRED' ||
    s === 'CANCELLED' ||
    s === 'CANCELED' ||
    s === 'SUSPENDED' ||
    s === 'FAILED' ||
    s === 'REFUNDED'
  );
}

/**
 * Evaluate whether AccountSubscription rows support a claimed renewal outcome.
 * Read-only — never writes to AccountSubscription.
 *
 * @param {object[]} subscriptions
 * @param {string} outcome
 * @param {{ now?: Date }} [opts]
 * @returns {{ ok: boolean, evidenceMissing?: boolean, reason?: string, subscriptionId?: string|null }}
 */
export function evaluateRenewalOutcomeEvidence(subscriptions, outcome, opts = {}) {
  const now = opts.now || new Date();
  const claimed = String(outcome || '').toUpperCase();
  const subs = Array.isArray(subscriptions) ? subscriptions : [];

  if (!claimed || !Object.values(CS_RENEWAL_OUTCOME).includes(claimed)) {
    return { ok: false, reason: 'invalid_outcome' };
  }

  if (claimed === CS_RENEWAL_OUTCOME.PENDING) {
    return { ok: true, subscriptionId: subs[0]?.id || null };
  }

  if (
    claimed === CS_RENEWAL_OUTCOME.RENEWED ||
    claimed === CS_RENEWAL_OUTCOME.EXTENDED
  ) {
    const match = subs.find((s) => {
      const expiresOk =
        s?.expiresAt && new Date(s.expiresAt).getTime() > now.getTime();
      const activeOk = s?.isActive === true || isActiveCompletedStatus(s?.status);
      return Boolean(expiresOk && activeOk);
    });
    if (!match) {
      return {
        ok: false,
        evidenceMissing: true,
        reason:
          'AccountSubscription evidence required: active/completed sub with future expiresAt',
      };
    }
    return { ok: true, subscriptionId: match.id };
  }

  if (
    claimed === CS_RENEWAL_OUTCOME.CHURNED ||
    claimed === CS_RENEWAL_OUTCOME.LOST
  ) {
    const match = subs.find((s) => {
      const expired =
        s?.expiresAt && new Date(s.expiresAt).getTime() <= now.getTime();
      const inactive = s?.isActive === false || isChurnEvidenceStatus(s?.status);
      return Boolean(expired || inactive);
    });
    if (!match) {
      return {
        ok: false,
        evidenceMissing: true,
        reason:
          'AccountSubscription evidence required: expired/cancelled/inactive subscription',
      };
    }
    return { ok: true, subscriptionId: match.id };
  }

  return { ok: false, evidenceMissing: true, reason: 'unsupported_outcome' };
}

async function loadSubscriptions(prisma, tenantId) {
  if (typeof prisma?.accountSubscription?.findMany !== 'function') return [];
  try {
    return await prisma.accountSubscription.findMany({
      where: { tenantId: String(tenantId) },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    try {
      return await prisma.accountSubscription.findMany({
        where: { tenantId: String(tenantId) },
      });
    } catch {
      return [];
    }
  }
}

/**
 * Open or return existing renewal workspace for tenant + period.
 */
export async function openRenewalWorkspace(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }

  const tenantId = args.tenantId ? String(args.tenantId) : '';
  const periodKey = args.periodKey
    ? String(args.periodKey)
    : new Date().toISOString().slice(0, 7);
  if (!tenantId) return { ok: false, error: 'tenantId required' };

  const gate = await assertCsTenantAccess(prisma, args.admin, tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  if (!hasRenewalModel(prisma)) {
    return {
      ok: false,
      error: 'cs_renewal_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let existing = null;
  try {
    existing = await prisma.csRenewalWorkspace.findFirst({
      where: { tenantId, periodKey },
    });
  } catch {
    existing = null;
  }

  if (existing) {
    return {
      ok: true,
      created: false,
      noop: true,
      workspace: serializeWorkspace(existing),
    };
  }

  const row = await prisma.csRenewalWorkspace.create({
    data: {
      tenantId,
      periodKey,
      status: CS_RENEWAL_STATUS.OPEN,
      notes: args.notes || null,
      openedByAdminId: args.admin?.id || null,
    },
  });

  return { ok: true, created: true, workspace: serializeWorkspace(row) };
}

/**
 * Set renewal outcome only when subscription evidence matches claimed outcome.
 */
export async function setRenewalOutcome(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canManageRenewals) {
    return { ok: false, forbidden: true, reason: 'manage_renewals_required' };
  }

  const workspaceId = args.workspaceId ? String(args.workspaceId) : '';
  const outcome = args.outcome ? String(args.outcome).toUpperCase() : '';
  if (!workspaceId || !outcome) {
    return { ok: false, error: 'workspaceId and outcome required' };
  }

  if (!hasRenewalModel(prisma)) {
    return {
      ok: false,
      error: 'cs_renewal_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let workspace = null;
  try {
    workspace =
      (await prisma.csRenewalWorkspace.findUnique?.({
        where: { id: workspaceId },
      })) ||
      (await prisma.csRenewalWorkspace.findFirst({
        where: { id: workspaceId },
      }));
  } catch {
    workspace = null;
  }

  if (!workspace) {
    return { ok: false, notFound: true, error: 'workspace_not_found' };
  }

  const gate = await assertCsTenantAccess(prisma, args.admin, workspace.tenantId, {
    now: args.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason || 'out_of_portfolio_scope' };
  }

  const subs = await loadSubscriptions(prisma, workspace.tenantId);
  const evidence = evaluateRenewalOutcomeEvidence(subs, outcome, {
    now: args.now,
  });

  if (!evidence.ok) {
    return {
      ok: false,
      evidenceMissing: Boolean(evidence.evidenceMissing),
      reason: evidence.reason || 'evidence_missing',
      error: evidence.reason || 'evidence_missing',
    };
  }

  const updated = await prisma.csRenewalWorkspace.update({
    where: { id: workspaceId },
    data: {
      outcome,
      outcomeAt: new Date(),
      outcomeByAdminId: args.admin?.id || null,
      subscriptionId: evidence.subscriptionId || null,
      evidenceNote: args.evidenceNote || evidence.reason || null,
      status: CS_RENEWAL_STATUS.CLOSED,
      notes: args.notes !== undefined ? args.notes : workspace.notes,
    },
  });

  return { ok: true, workspace: serializeWorkspace(updated), evidence };
}

export async function listRenewalWorkspaces(prisma, args = {}) {
  const access = resolveCsAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden', items: [] };
  }

  if (!hasRenewalModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'cs_renewal_model_unavailable' },
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

  const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.csRenewalWorkspace.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = await prisma.csRenewalWorkspace.findMany({ where });
  }

  return {
    ok: true,
    items: (rows || []).map(serializeWorkspace),
    meta: { count: (rows || []).length, scopeMode: scope.mode, limit },
  };
}

export { serializeWorkspace, hasRenewalModel };
