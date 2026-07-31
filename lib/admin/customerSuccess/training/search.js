/**
 * Training global search index — Phase 22 Wave 4 harden.
 * TRQ / TRN / cert numbers only. No answers, tokens, or restricted materials.
 * Fail closed when portfolio scope is required but omitted/empty for
 * non–Super Admin actors — never fail-open to all tenants.
 * Query fail → UNAVAILABLE / results null (never invent empty success).
 * Certificates have no tenantId — scope via programId → scoped programs.
 */

import {
  canViewTraining,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingRequestModel,
  hasCustomerTrainingCertificateModel,
  resolveTrainingActor,
} from './model.js';
import { getTrainingDomainContract } from './catalogue.js';
import {
  resolveTrainingListScope,
} from './listScope.js';
import { TRAINING_REPORT_STATUS } from './reliabilityGate.js';

const SENSITIVE_KEYS =
  /password|credential|secret|token|answer|restrictedMaterial|questionBank/i;

function sanitizeHit(row, kind) {
  return {
    id: row.id,
    kind,
    number:
      row.programNumber || row.requestNumber || row.certificateNumber || null,
    status: row.status || null,
    tenantId: row.tenantId || null,
    customerId: row.customerId || null,
  };
}

function searchQueryUnavailable(reason) {
  return {
    ok: false,
    status: TRAINING_REPORT_STATUS.UNAVAILABLE,
    results: null,
    reason,
    domain: getTrainingDomainContract(),
    meta: {
      excludesAnswers: true,
      excludesTokens: true,
      excludesRestrictedMaterials: true,
      failClosed: true,
      inventEmptyForbidden: true,
    },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, query?: string, portfolioTenantIds?: string[]|null, now?: Date }} args
 */
export async function searchTrainingIndex(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      results: [],
      reason: 'training_search_forbidden',
    };
  }

  const q = String(args.query || '').trim();
  if (!q) {
    return { ok: true, results: [], reason: 'empty_query' };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    return {
      ok: true,
      results: [],
      reason: scopeResult.reason,
      domain: getTrainingDomainContract(),
      meta: {
        excludesAnswers: true,
        excludesTokens: true,
        excludesRestrictedMaterials: true,
        portfolioScoped: true,
        failClosed: true,
      },
    };
  }

  const tenantScope = scopeResult.tenantScope;
  const results = [];

  if (hasCustomerTrainingProgramModel(prisma)) {
    const where = {
      OR: [{ programNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const programs = await prisma.customerTrainingProgram.findMany({ where });
      for (const p of programs || []) {
        if (tenantScope && !tenantScope.includes(p.tenantId)) continue;
        results.push(sanitizeHit(p, 'PROGRAM'));
      }
    } catch {
      return searchQueryUnavailable('training_search_query_failed');
    }
  }

  if (hasCustomerTrainingRequestModel(prisma)) {
    const where = {
      OR: [{ requestNumber: { contains: q } }],
    };
    if (tenantScope) {
      where.tenantId = { in: tenantScope };
    }
    try {
      const requests = await prisma.customerTrainingRequest.findMany({ where });
      for (const r of requests || []) {
        if (tenantScope && !tenantScope.includes(r.tenantId)) continue;
        results.push(sanitizeHit(r, 'REQUEST'));
      }
    } catch {
      return searchQueryUnavailable('training_search_query_failed');
    }
  }

  if (hasCustomerTrainingCertificateModel(prisma)) {
    try {
      let scopedProgramIds = null;
      if (tenantScope) {
        if (!hasCustomerTrainingProgramModel(prisma)) {
          scopedProgramIds = [];
        } else {
          const scopedPrograms = await prisma.customerTrainingProgram.findMany({
            where: { tenantId: { in: tenantScope } },
          });
          scopedProgramIds = (scopedPrograms || [])
            .filter((p) => tenantScope.includes(String(p.tenantId)))
            .map((p) => p.id);
        }
        if (!scopedProgramIds.length) {
          // fail closed — no cert enumeration outside portfolio
        } else {
          const where = {
            OR: [{ certificateNumber: { contains: q } }],
            programId: { in: scopedProgramIds },
          };
          const certs = await prisma.customerTrainingCertificate.findMany({
            where,
          });
          const allowed = new Set(scopedProgramIds);
          for (const c of certs || []) {
            if (!c.programId || !allowed.has(c.programId)) continue;
            results.push(sanitizeHit(c, 'CERTIFICATE'));
          }
        }
      } else {
        const where = {
          OR: [{ certificateNumber: { contains: q } }],
        };
        const certs = await prisma.customerTrainingCertificate.findMany({
          where,
        });
        for (const c of certs || []) {
          results.push(sanitizeHit(c, 'CERTIFICATE'));
        }
      }
    } catch {
      return searchQueryUnavailable('training_search_query_failed');
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
    domain: getTrainingDomainContract(),
    meta: {
      excludesAnswers: true,
      excludesTokens: true,
      excludesRestrictedMaterials: true,
      portfolioScoped: scopeResult.portfolioScoped,
    },
  };
}
