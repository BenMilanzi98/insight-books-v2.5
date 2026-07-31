/**
 * Conversion reconciliation foundations — Phase 16 Wave 4 / Phase 20 Wave 4 harden.
 * Lineage: acceptance → conversion → tenant/subscription → handoffs.
 * Never invent zeroes or lineageIntact:true on gate failure / thin instrumentation.
 * Sales-team / territory / customer / tenant fail-closed.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmConversionModel } from './model.js';
import {
  safeConversionCount,
  applyConversionReportHonesty,
  CRM_CONVERSION_REPORT_STATUS,
} from './reliabilityGate.js';
import { getConversionDomainContract } from './catalogue.js';
import {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';

export const CRM_CONVERSION_RECON_VERSION = 'crm-conversion-recon-v2-2026-07-31';

export function hasCrmConversionReconRunModel(prisma) {
  return typeof prisma?.crmConversionReconRun?.create === 'function';
}

export function hasCrmConversionDomainHandoffModel(prisma) {
  return typeof prisma?.crmConversionDomainHandoff?.create === 'function';
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
export async function runConversionReconciliation(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canRunReconciliation &&
    !access.canViewOpportunities &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      reason: 'crm_conversion_recon_forbidden',
      cards: null,
    };
  }

  if (!hasCrmConversionModel(prisma)) {
    const honesty = applyConversionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        conversionPlane: true,
      },
      definitionVersion: CRM_CONVERSION_RECON_VERSION,
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
      cards: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: CRM_CONVERSION_RECON_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = whereFromConversionScope(scopeResult);
  const conversions = await safeConversionCount(() =>
    prisma.crmConversion.count({ where: scopeWhere })
  );
  if (!conversions.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        conversionPlane: true,
        ...honesty,
      },
      definitionVersion: CRM_CONVERSION_RECON_VERSION,
      domain: getConversionDomainContract(),
    };
  }

  if (conversions.value === 0) {
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.EMPTY,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        conversionPlane: true,
        kpiSafe: false,
      },
      definitionVersion: CRM_CONVERSION_RECON_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const handoffs = hasCrmConversionDomainHandoffModel(prisma)
    ? await safeConversionCount(() =>
        prisma.crmConversionDomainHandoff.count({ where: scopeWhere })
      )
    : { ok: true, value: null };

  // Thin stub: conversions count is real; lineage integrity is not instrumented —
  // never invent lineageIntact: true. Null + UNAVAILABLE for that check.
  const cards = {
    conversions: conversions.value,
    domainHandoffs: handoffs.ok ? handoffs.value : null,
    lineageIntact: null,
    lineageIntactStatus: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
  };

  if (args.persist && hasCrmConversionReconRunModel(prisma)) {
    await prisma.crmConversionReconRun.create({
      data: {
        status: CRM_CONVERSION_REPORT_STATUS.READY,
        cardsJson: cards,
        createdByAdminId: args.admin?.id || null,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
  }

  return {
    ok: true,
    status: CRM_CONVERSION_REPORT_STATUS.READY,
    cards,
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      conversionPlane: true,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: CRM_CONVERSION_RECON_VERSION,
    domain: getConversionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
