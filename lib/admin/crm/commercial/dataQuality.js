/**
 * Commercial data-quality foundations — Phase 15 Wave 4.
 * Light checks. Never invent DQ scores or false zeroes on gate failure.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_RELIABILITY_STATUS } from '../catalogue.js';
import { hasCrmCommercialDocumentModel, hasCrmCommercialAcceptanceModel } from './model.js';
import { safeCommercialCount } from './reliabilityGate.js';
import { getCommercialDomainContract } from './catalogue.js';

export const CRM_COMMERCIAL_DQ_VERSION = 'crm-commercial-dq-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, persist?: boolean }} args
 */
export async function runCommercialDataQuality(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canRunReconciliation &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      reason: 'crm_commercial_dq_forbidden',
      checks: null,
    };
  }

  if (!hasCrmCommercialDocumentModel(prisma)) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      reason: 'crm_commercial_document_model_unavailable',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
      definitionVersion: CRM_COMMERCIAL_DQ_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const total = await safeCommercialCount(() => prisma.crmCommercialDocument.count());
  const accepted = hasCrmCommercialAcceptanceModel(prisma)
    ? await safeCommercialCount(() => prisma.crmCommercialAcceptance.count())
    : { ok: true, value: null };

  if (!total.ok || (hasCrmCommercialAcceptanceModel(prisma) && !accepted.ok)) {
    return {
      ok: true,
      status: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      reason: 'commercial_dq_gate_failed',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
      definitionVersion: CRM_COMMERCIAL_DQ_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  if (total.value === 0) {
    return {
      ok: true,
      status: 'EMPTY',
      checks: {
        totalDocuments: null,
        accepted: null,
      },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
      },
      definitionVersion: CRM_COMMERCIAL_DQ_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const checks = {
    totalDocuments: total.value,
    accepted: accepted.ok ? accepted.value : null,
    acceptanceWithoutVersion: null,
  };

  // Soft orphan check when findMany available
  if (
    hasCrmCommercialAcceptanceModel(prisma) &&
    typeof prisma.crmCommercialAcceptance.findMany === 'function'
  ) {
    try {
      const rows = await prisma.crmCommercialAcceptance.findMany({});
      checks.acceptanceWithoutVersion = rows.filter(
        (r) => !r.documentVersionId || !r.checksumSha256 || !r.authorityRole
      ).length;
    } catch {
      checks.acceptanceWithoutVersion = null;
    }
  }

  if (args.persist && typeof prisma.crmCommercialDqIncident?.create === 'function') {
    const incidentCount =
      typeof checks.acceptanceWithoutVersion === 'number'
        ? checks.acceptanceWithoutVersion
        : 0;
    if (incidentCount > 0) {
      await prisma.crmCommercialDqIncident.create({
        data: {
          code: 'ACCEPTANCE_EVIDENCE_INCOMPLETE',
          severity: 'HIGH',
          count: incidentCount,
          detailJson: checks,
          createdAt: args.now || new Date(),
          updatedAt: args.now || new Date(),
        },
      });
    }
  }

  return {
    ok: true,
    status: CRM_RELIABILITY_STATUS.AVAILABLE,
    checks,
    honesty: { inventZeroesForbidden: true, falseZeroes: false },
    definitionVersion: CRM_COMMERCIAL_DQ_VERSION,
    domain: getCommercialDomainContract(),
  };
}
