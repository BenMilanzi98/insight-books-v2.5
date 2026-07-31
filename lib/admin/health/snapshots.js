/**
 * Immutable CustomerHealthSnapshot persistence.
 * Rebuild always creates a new row (never mutates prior snapshots).
 */

import { HEALTH_DEFINITION_VERSION } from './catalogue.js';
import {
  resolveHealthAccess,
  assertHealthTenantAccess,
  resolveHealthPortfolioScope,
  healthTenantIdFilter,
} from './authz.js';
import { applyPortfolioTenantWhere } from '@/lib/admin/customers/portfolioScope.js';
import { evaluateCustomerHealth } from './evaluate.js';

function hasSnapshotModel(prisma) {
  return typeof prisma?.customerHealthSnapshot?.create === 'function';
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} evaluation — from evaluateCustomerHealth
 */
export async function persistHealthSnapshot(prisma, evaluation) {
  if (!evaluation?.ok || !evaluation.tenantId) {
    return {
      ok: false,
      error: evaluation?.error || 'evaluation_required',
      forbidden: Boolean(evaluation?.forbidden),
    };
  }

  if (!hasSnapshotModel(prisma)) {
    return {
      ok: false,
      error: 'CustomerHealthSnapshot model unavailable',
      reasonCode: 'model_unavailable',
      ephemeral: {
        tenantId: evaluation.tenantId,
        definitionVersion: evaluation.definitionVersion,
        score: evaluation.score,
        band: evaluation.band,
        confidence: evaluation.confidence,
        asOf: evaluation.asOf,
        payload: evaluation,
      },
    };
  }

  const row = await prisma.customerHealthSnapshot.create({
    data: {
      tenantId: evaluation.tenantId,
      definitionVersion: evaluation.definitionVersion || HEALTH_DEFINITION_VERSION,
      score: evaluation.score,
      band: evaluation.band,
      confidence: evaluation.confidence,
      asOf: evaluation.asOf ? new Date(evaluation.asOf) : new Date(),
      payload: {
        dimensions: evaluation.dimensions,
        drivers: evaluation.drivers,
        missing: evaluation.missing,
        overrides: evaluation.overrides,
        weightSum: evaluation.weightSum,
        customer: evaluation.customer,
        disclaimer: evaluation.disclaimer,
      },
    },
  });

  return {
    ok: true,
    id: row.id,
    tenantId: row.tenantId,
    definitionVersion: row.definitionVersion,
    score: row.score,
    band: row.band,
    confidence: row.confidence,
    asOf: row.asOf,
    createdAt: row.createdAt,
  };
}

/**
 * Rebuild snapshot for one tenant (immutable append).
 */
export async function rebuildHealthSnapshot(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true };
  }
  if (!access.canRebuild) {
    return {
      ok: false,
      forbidden: true,
      reason: 'rebuild_forbidden',
    };
  }

  const evaluation = await evaluateCustomerHealth(prisma, opts);
  if (!evaluation.ok) return evaluation;

  const snap = await persistHealthSnapshot(prisma, evaluation);
  return {
    ok: Boolean(snap.id || snap.ok),
    evaluation,
    snapshot: snap,
  };
}

/**
 * List latest snapshots in portfolio scope.
 * Never replaces scoped tenantIds with an unchecked tenantId query param.
 */
export async function listHealthSnapshots(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, rows: [] };
  }

  const now = opts.now || new Date();
  const scope = await resolveHealthPortfolioScope(prisma, opts.admin, { now });
  if (!scope.canView) {
    return { ok: false, forbidden: true, rows: [] };
  }

  // Optional tenantId filter must pass portfolio gate — never overwrite scope unchecked
  if (opts.tenantId) {
    const gate = await assertHealthTenantAccess(prisma, opts.admin, opts.tenantId, {
      now,
    });
    if (!gate.ok) {
      return {
        ok: false,
        forbidden: true,
        rows: [],
        reason: gate.reason || 'out_of_portfolio_scope',
      };
    }
  }

  if (!hasSnapshotModel(prisma)) {
    return {
      ok: true,
      rows: [],
      total: 0,
      limitations: ['CustomerHealthSnapshot model unavailable'],
    };
  }

  const where = {};
  const tenantFilter = healthTenantIdFilter(scope);
  if (tenantFilter) where.tenantId = tenantFilter;
  if (opts.tenantId) where.tenantId = String(opts.tenantId);
  if (opts.band) where.band = String(opts.band);

  const take = Math.min(200, Math.max(1, parseInt(String(opts.pageSize || 50), 10) || 50));
  const rows = await prisma.customerHealthSnapshot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });

  // Optionally filter to latest per tenant
  let out = rows;
  if (opts.latestOnly) {
    const seen = new Set();
    out = [];
    for (const r of rows) {
      if (seen.has(r.tenantId)) continue;
      seen.add(r.tenantId);
      out.push(r);
    }
  }

  return {
    ok: true,
    rows: out,
    total: out.length,
    scope: {
      mode: scope.mode,
      isAgentScoped: scope.isAgentScoped,
    },
  };
}

/**
 * Latest snapshot for one tenant (portfolio-gated).
 */
export async function getLatestHealthSnapshot(prisma, opts = {}) {
  const access = resolveHealthAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true };
  }
  const gate = await assertHealthTenantAccess(prisma, opts.admin, opts.tenantId, {
    now: opts.now,
  });
  if (!gate.ok) {
    return { ok: false, forbidden: true, reason: gate.reason };
  }

  if (!hasSnapshotModel(prisma)) {
    return { ok: false, error: 'model_unavailable', notFound: true };
  }

  const row = await prisma.customerHealthSnapshot.findFirst({
    where: { tenantId: String(opts.tenantId) },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) return { ok: false, notFound: true };
  return { ok: true, snapshot: row };
}

export { applyPortfolioTenantWhere };
