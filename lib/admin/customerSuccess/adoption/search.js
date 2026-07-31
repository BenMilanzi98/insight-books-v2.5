/**
 * Adoption global search index — Phase 19 Wave 4.
 * ADR / ADP / expansion handoff ids. No secrets or tokens.
 * Fail closed when portfolio scope is required but omitted/empty for
 * non–Super Admin actors — never fail-open to all tenants.
 * Expansion handoffs have no tenantId — scope via planId → plan.tenantId.
 */

import {
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionRequestModel,
  hasCustomerAdoptionExpansionHandoffModel,
  resolveAdoptionActor,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import { resolveAdoptionListScope } from './listScope.js';

const SENSITIVE_KEYS = /password|credential|secret|token|answer/i;

function sanitizeHit(row, kind) {
  return {
    id: row.id,
    kind,
    number: row.planNumber || row.requestNumber || row.id || null,
    status: row.status || null,
    tenantId: row.tenantId || null,
    customerId: row.customerId || null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, query?: string, portfolioTenantIds?: string[]|null, now?: Date }} args
 */
export async function searchAdoptionIndex(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      results: [],
      reason: 'adoption_search_forbidden',
    };
  }

  const q = String(args.query || '').trim();
  if (!q) {
    return { ok: true, results: [], reason: 'empty_query' };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      results: [],
      reason: scopeResult.reason,
      domain: getAdoptionDomainContract(),
      meta: {
        excludesSecrets: true,
        excludesTokens: true,
        portfolioScoped: true,
        failClosed: true,
      },
    };
  }

  const tenantScope = scopeResult.tenantScope;
  const results = [];

  if (hasCustomerAdoptionPlanModel(prisma)) {
    const where = {
      OR: [{ planNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const plans = await prisma.customerAdoptionPlan.findMany({ where });
      for (const p of plans || []) {
        if (tenantScope && !tenantScope.includes(p.tenantId)) continue;
        results.push(sanitizeHit(p, 'PLAN'));
      }
    } catch {
      // fail closed — omit plans
    }
  }

  if (hasCustomerAdoptionRequestModel(prisma)) {
    const where = {
      OR: [{ requestNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const requests = await prisma.customerAdoptionRequest.findMany({ where });
      for (const r of requests || []) {
        if (tenantScope && !tenantScope.includes(r.tenantId)) continue;
        results.push(sanitizeHit(r, 'REQUEST'));
      }
    } catch {
      // fail closed
    }
  }

  if (hasCustomerAdoptionExpansionHandoffModel(prisma)) {
    try {
      let scopedPlanIds = null;
      if (tenantScope) {
        if (!hasCustomerAdoptionPlanModel(prisma)) {
          scopedPlanIds = [];
        } else {
          const scopedPlans = await prisma.customerAdoptionPlan.findMany({
            where: { tenantId: { in: tenantScope } },
          });
          scopedPlanIds = (scopedPlans || [])
            .filter((p) => tenantScope.includes(String(p.tenantId)))
            .map((p) => p.id);
        }
        if (!scopedPlanIds.length) {
          // fail closed — no handoff enumeration outside portfolio
        } else {
          const where = {
            OR: [{ id: { contains: q } }],
            planId: { in: scopedPlanIds },
          };
          const handoffs = await prisma.customerAdoptionExpansionHandoff.findMany({
            where,
          });
          const allowed = new Set(scopedPlanIds);
          for (const h of handoffs || []) {
            if (!h.planId || !allowed.has(h.planId)) continue;
            results.push(sanitizeHit(h, 'EXPANSION_HANDOFF'));
          }
        }
      } else {
        const where = {
          OR: [{ id: { contains: q } }],
        };
        const handoffs = await prisma.customerAdoptionExpansionHandoff.findMany({
          where,
        });
        for (const h of handoffs || []) {
          results.push(sanitizeHit(h, 'EXPANSION_HANDOFF'));
        }
      }
    } catch {
      // fail closed — omit handoffs
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
    domain: getAdoptionDomainContract(),
    meta: {
      excludesSecrets: true,
      excludesTokens: true,
      portfolioScoped: scopeResult.portfolioScoped,
    },
  };
}
