/**
 * Conversion search index — Phase 20 Wave 4.
 * Conversion / request numbers. No secrets or tokens.
 * Fail closed when sales-team / territory / customer / tenant scope omitted
 * for non–Super Admin — never fail-open to all tenants.
 */

import { resolveCrmAccess } from '../authz.js';
import {
  hasCrmConversionModel,
  hasCrmConversionRequestModel,
} from './model.js';
import { getConversionDomainContract } from './catalogue.js';
import {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';

function sanitizeHit(row, kind) {
  return {
    id: row.id,
    kind,
    number: row.conversionNumber || row.requestNumber || row.id || null,
    status: row.status || null,
    tenantId: row.tenantId || null,
    customerId: row.customerId || null,
    teamId: row.teamId || null,
    territoryId: row.territoryId || null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   query?: string,
 *   tenantIds?: string[],
 *   customerIds?: string[],
 *   salesTeamIds?: string[],
 *   teamIds?: string[],
 *   territoryIds?: string[],
 * }} args
 */
export async function searchConversionIndex(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      results: [],
      reason: 'conversion_search_forbidden',
    };
  }

  const q = String(args.query || '').trim();
  if (!q) {
    return { ok: true, results: [], reason: 'empty_query' };
  }

  const scopeResult = await resolveConversionListScope(prisma, args.admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      results: [],
      reason: scopeResult.reason,
      domain: getConversionDomainContract(),
      meta: {
        excludesSecrets: true,
        excludesTokens: true,
        portfolioScoped: true,
        failClosed: true,
      },
    };
  }

  const scopeWhere = whereFromConversionScope(scopeResult);
  const results = [];

  if (hasCrmConversionModel(prisma)) {
    const where = {
      AND: [
        scopeWhere,
        { OR: [{ conversionNumber: { contains: q } }, { id: { contains: q } }] },
      ].filter((w) => w && Object.keys(w).length),
    };
    try {
      const rows = await prisma.crmConversion.findMany({ where });
      for (const r of rows || []) {
        results.push(sanitizeHit(r, 'CONVERSION'));
      }
    } catch {
      // fail closed — omit conversions
    }
  }

  if (hasCrmConversionRequestModel(prisma)) {
    const where = {
      AND: [
        scopeWhere,
        { OR: [{ requestNumber: { contains: q } }, { id: { contains: q } }] },
      ].filter((w) => w && Object.keys(w).length),
    };
    try {
      const rows = await prisma.crmConversionRequest.findMany({ where });
      for (const r of rows || []) {
        results.push(sanitizeHit(r, 'REQUEST'));
      }
    } catch {
      // fail closed
    }
  }

  return {
    ok: true,
    results,
    domain: getConversionDomainContract(),
    meta: {
      excludesSecrets: true,
      excludesTokens: true,
      portfolioScoped: Boolean(scopeResult.portfolioScoped),
    },
  };
}
