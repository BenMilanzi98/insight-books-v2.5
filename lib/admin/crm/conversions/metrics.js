/**
 * Conversion metrics — Phase 16 Wave 4 / Phase 20 Wave 4 harden.
 * Reliability-gated; gate fail ≠ fabricated zero.
 * Sales-team / territory / customer / tenant fail-closed for non–Super Admin.
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

export const CRM_CONVERSION_METRIC_VERSION = 'crm-conversion-metric-v2-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin?: object,
 *   metric?: string,
 *   tenantIds?: string[],
 *   customerIds?: string[],
 *   salesTeamIds?: string[],
 *   teamIds?: string[],
 *   territoryIds?: string[],
 * }} args
 */
export async function getConversionMetric(prisma, args = {}) {
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
      status: honesty.status,
      value: null,
      honesty,
      definitionVersion: CRM_CONVERSION_METRIC_VERSION,
    };
  }

  if (!hasCrmConversionModel(prisma)) {
    const honesty = applyConversionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'crm_conversion_model_unavailable',
      definitionVersion: CRM_CONVERSION_METRIC_VERSION,
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
      value: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: CRM_CONVERSION_METRIC_VERSION,
      domain: getConversionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
      valueLabel: getConversionValueLabelHonesty(),
    };
  }

  const metric = String(args.metric || 'conversion_count').trim().toLowerCase();
  const where = whereFromConversionScope(scopeResult);
  const counted = await safeConversionCount(() =>
    prisma.crmConversion.count({ where })
  );

  if (!counted.ok) {
    const honesty = applyConversionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'crm_conversion_metric_query_failed',
      definitionVersion: CRM_CONVERSION_METRIC_VERSION,
      domain: getConversionDomainContract(),
    };
  }

  const honesty = applyConversionReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: CRM_CONVERSION_REPORT_STATUS.READY,
    metric,
    value: counted.value,
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    valueLabel: getConversionValueLabelHonesty(),
    definitionVersion: CRM_CONVERSION_METRIC_VERSION,
    domain: getConversionDomainContract(),
  };
}
