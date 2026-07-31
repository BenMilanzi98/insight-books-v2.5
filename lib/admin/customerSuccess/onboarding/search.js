/**
 * Onboarding global search index — Phase 17 Wave 4.
 * ONB/ONR numbers only. No migration file contents, no credentials.
 * Inaccessible projects/requests excluded by portfolio tenant scope.
 * Fail closed when portfolio scope is required but omitted/empty for
 * non–Super Admin actors — never fail-open to all tenants.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  hasCustomerOnboardingRequestModel,
  resolveOnboardingActor,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import { resolveCsAccess, resolveCsPortfolioScope } from '../authz.js';

const SENSITIVE_KEYS =
  /password|credential|secret|api[_-]?key|migrationFile|mraCredential|token/i;

function sanitizeHit(row, kind) {
  return {
    id: row.id,
    kind,
    number: row.onboardingNumber || row.requestNumber || null,
    status: row.status || null,
    tenantId: row.tenantId || null,
    customerId: row.customerId || null,
  };
}

/**
 * Resolve tenant scope for search.
 * - Explicit portfolioTenantIds[]: use it; empty → fail closed.
 * - Omitted: resolve actor portfolio; Super Admin mode=all may see all;
 *   scoped CS with empty/missing scope → fail closed (never all tenants).
 *
 * @returns {{ ok: true, tenantScope: string[]|null, portfolioScoped: boolean } | { ok: false, reason: string }}
 */
async function resolveSearchPortfolioScope(prisma, admin, args = {}) {
  if (Array.isArray(args.portfolioTenantIds)) {
    if (args.portfolioTenantIds.length === 0) {
      return { ok: false, reason: 'portfolio_scope_empty' };
    }
    return {
      ok: true,
      tenantScope: args.portfolioTenantIds.map(String),
      portfolioScoped: true,
    };
  }

  const access = resolveCsAccess(admin);
  const scope = await resolveCsPortfolioScope(prisma, admin, { now: args.now });

  // Super Admin may see all only when portfolio scope explicitly permits (mode=all)
  if (access.isSuperAdmin && scope.mode === 'all' && scope.isSuperAdmin) {
    return { ok: true, tenantScope: null, portfolioScoped: false };
  }

  const ids = Array.isArray(scope.tenantIds) ? scope.tenantIds.map(String) : [];
  if (!ids.length) {
    return { ok: false, reason: 'portfolio_scope_required' };
  }
  return { ok: true, tenantScope: ids, portfolioScoped: true };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, query?: string, portfolioTenantIds?: string[]|null, now?: Date }} args
 */
export async function searchOnboardingIndex(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      results: [],
      reason: 'onboarding_search_forbidden',
    };
  }

  const q = String(args.query || '').trim();
  if (!q) {
    return { ok: true, results: [], reason: 'empty_query' };
  }

  const scopeResult = await resolveSearchPortfolioScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      results: [],
      reason: scopeResult.reason,
      domain: getOnboardingDomainContract(),
      meta: {
        excludesMigrationFiles: true,
        excludesCredentials: true,
        portfolioScoped: true,
        failClosed: true,
      },
    };
  }

  const tenantScope = scopeResult.tenantScope;
  const results = [];

  if (hasCustomerOnboardingProjectModel(prisma)) {
    const where = {
      OR: [{ onboardingNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const projects = await prisma.customerOnboardingProject.findMany({ where });
      for (const p of projects || []) {
        if (tenantScope && !tenantScope.includes(p.tenantId)) continue;
        results.push(sanitizeHit(p, 'PROJECT'));
      }
    } catch {
      // fail closed — omit projects
    }
  }

  if (hasCustomerOnboardingRequestModel(prisma)) {
    const where = {
      OR: [{ requestNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const requests = await prisma.customerOnboardingRequest.findMany({ where });
      for (const r of requests || []) {
        if (tenantScope && !tenantScope.includes(r.tenantId)) continue;
        results.push(sanitizeHit(r, 'REQUEST'));
      }
    } catch {
      // fail closed
    }
  }

  const payload = JSON.stringify(results);
  if (SENSITIVE_KEYS.test(payload)) {
    return {
      ok: false,
      error: 'search_sanitization_failed',
      results: [],
    };
  }

  return {
    ok: true,
    results,
    domain: getOnboardingDomainContract(),
    meta: {
      excludesMigrationFiles: true,
      excludesCredentials: true,
      portfolioScoped: scopeResult.portfolioScoped,
    },
  };
}
