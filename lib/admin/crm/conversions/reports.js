/**
 * Conversion reporting centre — Phase 16 Wave 4 / Phase 20 Wave 4 harden.
 * Honesty-gated: gate fail → never fabricated zeroes.
 * Sales-team / territory / customer / tenant fail-closed.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmConversionModel } from './model.js';
import { getConversionDomainContract } from './catalogue.js';
import {
  applyConversionReportHonesty,
  safeConversionCount,
  CRM_CONVERSION_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';
import { getConversionValueLabelHonesty } from './valueLabels.js';

export const CRM_CONVERSION_REPORT_VERSION = 'crm-conversion-report-v2-2026-07-31';

export { applyConversionReportHonesty, CRM_CONVERSION_REPORT_STATUS } from './reliabilityGate.js';

/**
 * Full conversion report KPIs (honesty-gated).
 */
export async function getConversionReport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canExport &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    const honesty = applyConversionReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_conversion_report_forbidden',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_CONVERSION_REPORT_VERSION,
    };
  }

  if (!hasCrmConversionModel(prisma)) {
    const honesty = applyConversionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_conversion_model_unavailable',
      report: null,
      honesty,
      definitionVersion: CRM_CONVERSION_REPORT_VERSION,
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
      reason: scopeResult.reason,
      status: CRM_CONVERSION_REPORT_STATUS.UNAVAILABLE,
      report: null,
      honesty,
      definitionVersion: CRM_CONVERSION_REPORT_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const where = whereFromConversionScope(scopeResult);
  const total = await safeConversionCount(() =>
    prisma.crmConversion.count({ where })
  );
  if (!total.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_conversion_report_query_failed',
      report: null,
      honesty,
      definitionVersion: CRM_CONVERSION_REPORT_VERSION,
      domain: getConversionDomainContract(),
    };
  }

  const honesty = applyConversionReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });
  const valueLabel = getConversionValueLabelHonesty();

  if (total.value === 0) {
    return {
      ok: true,
      status: CRM_CONVERSION_REPORT_STATUS.EMPTY,
      report: {
        kpis: { totalConversions: 0 },
        empty: true,
        valueLabel,
      },
      honesty: { ...honesty, reliability: 'AVAILABLE' },
      definitionVersion: CRM_CONVERSION_REPORT_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  return {
    ok: true,
    status: CRM_CONVERSION_REPORT_STATUS.READY,
    report: {
      kpis: { totalConversions: total.value },
      empty: false,
      scopeMode: scopeResult.portfolioScoped ? 'scoped' : 'all',
      valueLabel,
      isRevenue: false,
    },
    honesty: { ...honesty, reliability: 'AVAILABLE' },
    definitionVersion: CRM_CONVERSION_REPORT_VERSION,
    domain: getConversionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}

/**
 * Conversion overview hub data.
 */
export async function getConversionOverview(prisma, args = {}) {
  const report = await getConversionReport(prisma, args);
  if (!report.ok || report.report == null) {
    return {
      ...report,
      overview: null,
    };
  }
  return {
    ok: true,
    status: report.status,
    overview: {
      totalConversions: report.report.kpis?.totalConversions ?? null,
      empty: report.report.empty === true,
      valueLabel: report.report.valueLabel || getConversionValueLabelHonesty(),
      isRevenue: false,
    },
    honesty: report.honesty,
    definitionVersion: CRM_CONVERSION_REPORT_VERSION,
    domain: getConversionDomainContract(),
    meta: report.meta,
  };
}
