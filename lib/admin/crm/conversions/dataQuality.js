/**
 * Conversion data-quality foundations — Phase 16 Wave 4 / Phase 20 Wave 4 harden.
 * Never invent DQ scores or false zeroes on gate failure.
 * Sales-team / territory / customer / tenant fail-closed.
 */

import { resolveCrmAccess } from '../authz.js';
import {
  hasCrmConversionModel,
  hasCrmConversionRequestModel,
} from './model.js';
import { safeConversionCount, CRM_CONVERSION_REPORT_STATUS } from './reliabilityGate.js';
import { applyConversionReportHonesty } from './reliabilityGate.js';
import { getConversionDomainContract } from './catalogue.js';
import {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';

export const CRM_CONVERSION_DQ_VERSION = 'crm-conversion-dq-v2-2026-07-31';

export function hasCrmConversionDqIncidentModel(prisma) {
  return typeof prisma?.crmConversionDqIncident?.create === 'function';
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   persist?: boolean,
 *   now?: Date,
 *   tenantIds?: string[],
 *   customerIds?: string[],
 *   salesTeamIds?: string[],
 *   teamIds?: string[],
 *   territoryIds?: string[],
 * }} args
 */
export async function runConversionDataQuality(prisma, args = {}) {
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
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reason: 'crm_conversion_dq_forbidden',
      checks: null,
    };
  }

  if (!hasCrmConversionModel(prisma)) {
    const honesty = applyConversionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_conversion_model_unavailable',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
    };
  }

  const scopeResult = await resolveConversionListScope(prisma, args.admin, args);
  if (!scopeResult.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: !scopeResult.forbidden,
    });
    return {
      ok: scopeResult.forbidden ? false : true,
      forbidden: Boolean(scopeResult.forbidden),
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      checks: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = whereFromConversionScope(scopeResult);
  const total = await safeConversionCount(() =>
    prisma.crmConversion.count({ where: scopeWhere })
  );
  if (!total.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reason: 'conversion_dq_gate_failed',
      checks: null,
      honesty: { inventZeroesForbidden: true, falseZeroes: false, ...honesty },
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
    };
  }

  if (total.value === 0) {
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.EMPTY,
      checks: { totalConversions: null, totalRequests: null, blockingDq: null },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
      },
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  // Request model missing → UNAVAILABLE / totalRequests null — never invent 0.
  if (!hasCrmConversionRequestModel(prisma)) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: false,
      queryOk: true,
      permissionOk: true,
    });
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalConversions: total.value,
        totalRequests: null,
        missingAcceptanceChecksum: null,
        blockingDq: null,
        blockingDqStatus: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'crm_conversion_request_model_unavailable',
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const requests = await safeConversionCount(() =>
    prisma.crmConversionRequest.count({ where: scopeWhere })
  );
  if (!requests.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalConversions: total.value,
        totalRequests: null,
        missingAcceptanceChecksum: null,
        blockingDq: null,
        blockingDqStatus: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'conversion_dq_request_query_failed',
      definitionVersion: CRM_CONVERSION_DQ_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const checks = {
    totalConversions: total.value,
    totalRequests: requests.value,
    missingAcceptanceChecksum: null,
    blockingDq: null,
    blockingDqStatus: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
  };

  if (typeof prisma.crmConversion.findMany === 'function') {
    try {
      const rows = await prisma.crmConversion.findMany({ where: scopeWhere });
      checks.missingAcceptanceChecksum = rows.filter(
        (r) => !r.checksumSha256 || !r.acceptanceId
      ).length;
    } catch {
      checks.missingAcceptanceChecksum = null;
    }
  }

  if (
    args.persist &&
    hasCrmConversionDqIncidentModel(prisma) &&
    typeof checks.missingAcceptanceChecksum === 'number' &&
    checks.missingAcceptanceChecksum > 0
  ) {
    await prisma.crmConversionDqIncident.create({
      data: {
        code: 'ACCEPTANCE_CHECKSUM_MISSING',
        severity: 'HIGH',
        count: checks.missingAcceptanceChecksum,
        detailJson: checks,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
  }

  return {
    ok: true,
    status: CRM_CONVERSION_REPORT_STATUS.READY,
    checks,
    honesty: { inventZeroesForbidden: true, falseZeroes: false },
    definitionVersion: CRM_CONVERSION_DQ_VERSION,
    domain: getConversionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
