/**
 * Commercial metrics — Phase 15 Wave 4.
 * Reliability-gated; gate fail ≠ fabricated zero.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_COMMERCIAL_REPORT_STATUS } from '../catalogue.js';
import { hasCrmCommercialDocumentModel } from './model.js';
import { getCommercialDomainContract } from './catalogue.js';
import {
  applyCommercialReportHonesty,
  safeCommercialCount,
} from './reliabilityGate.js';

export const CRM_COMMERCIAL_METRIC_VERSION = 'crm-commercial-metric-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, metric?: string }} args
 */
export async function getCommercialMetric(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canExport &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    const honesty = applyCommercialReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      value: null,
      honesty,
      definitionVersion: CRM_COMMERCIAL_METRIC_VERSION,
    };
  }

  if (!hasCrmCommercialDocumentModel(prisma)) {
    const honesty = applyCommercialReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'crm_commercial_document_model_unavailable',
      definitionVersion: CRM_COMMERCIAL_METRIC_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const metric = String(args.metric || 'document_count').trim().toLowerCase();
  let counted;
  if (metric === 'accepted_count') {
    if (typeof prisma.crmCommercialAcceptance?.count !== 'function') {
      const honesty = applyCommercialReportHonesty({ modelAvailable: false });
      return {
        ok: true,
        status: honesty.status,
        value: null,
        honesty,
        definitionVersion: CRM_COMMERCIAL_METRIC_VERSION,
      };
    }
    counted = await safeCommercialCount(() => prisma.crmCommercialAcceptance.count());
  } else {
    counted = await safeCommercialCount(() => prisma.crmCommercialDocument.count());
  }

  if (!counted.ok) {
    const honesty = applyCommercialReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'crm_commercial_metric_query_failed',
      definitionVersion: CRM_COMMERCIAL_METRIC_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const honesty = applyCommercialReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: CRM_COMMERCIAL_REPORT_STATUS.READY,
    metric,
    value: counted.value,
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
    },
    definitionVersion: CRM_COMMERCIAL_METRIC_VERSION,
    domain: getCommercialDomainContract(),
  };
}
