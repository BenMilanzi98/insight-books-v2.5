/**
 * Commercial reporting centre — Phase 15 Wave 4.
 * Honesty-gated: gate fail → never fabricated zeroes.
 * Currency-separated overview (no silent ZAR+USD sum).
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import { CRM_COMMERCIAL_REPORT_STATUS, CRM_RELIABILITY_STATUS } from '../catalogue.js';
import { hasCrmCommercialDocumentModel } from './model.js';
import { getCommercialDomainContract } from './catalogue.js';
import {
  applyCommercialReportHonesty,
  safeCommercialCount,
} from './reliabilityGate.js';

export const CRM_COMMERCIAL_REPORT_VERSION = 'crm-commercial-report-v1-2026-07-31';

export { applyCommercialReportHonesty } from './reliabilityGate.js';

/**
 * Full commercial report KPIs (honesty-gated).
 */
export async function getCommercialReport(prisma, args = {}) {
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
      reason: 'crm_commercial_report_forbidden',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'opportunities');
  if (!scope.canView && !access.isSuperAdmin) {
    const honesty = applyCommercialReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_scope_denied',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
    };
  }

  if (!hasCrmCommercialDocumentModel(prisma)) {
    const honesty = applyCommercialReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_commercial_document_model_unavailable',
      report: null,
      honesty,
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const total = await safeCommercialCount(() => prisma.crmCommercialDocument.count());
  const accepted =
    typeof prisma.crmCommercialAcceptance?.count === 'function'
      ? await safeCommercialCount(() => prisma.crmCommercialAcceptance.count())
      : { ok: true, value: null };

  if (!total.ok) {
    const honesty = applyCommercialReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_commercial_report_query_failed',
      report: null,
      honesty,
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  const honesty = applyCommercialReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  if (total.value === 0) {
    return {
      ok: true,
      status: CRM_COMMERCIAL_REPORT_STATUS.EMPTY,
      report: {
        kpis: {
          totalDocuments: 0,
          accepted: accepted.ok ? accepted.value : null,
        },
        empty: true,
        currencySeparated: true,
      },
      honesty: {
        ...honesty,
        reliability: CRM_RELIABILITY_STATUS.AVAILABLE,
      },
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
      domain: getCommercialDomainContract(),
    };
  }

  return {
    ok: true,
    status: CRM_COMMERCIAL_REPORT_STATUS.READY,
    report: {
      kpis: {
        totalDocuments: total.value,
        accepted: accepted.ok ? accepted.value : null,
      },
      empty: false,
      currencySeparated: true,
      scopeMode: scope.mode || 'all',
    },
    honesty: {
      ...honesty,
      reliability: CRM_RELIABILITY_STATUS.AVAILABLE,
    },
    definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
    domain: getCommercialDomainContract(),
  };
}

/**
 * Commercial overview hub data — currency-separated; never silent multi-currency sum.
 */
export async function getCommercialOverview(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    const honesty = applyCommercialReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      byCurrency: null,
      honesty,
    };
  }

  if (!hasCrmCommercialDocumentModel(prisma)) {
    const honesty = applyCommercialReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      byCurrency: null,
      silentMultiCurrencySum: false,
      honesty: { ...honesty, currencySeparated: true },
      domain: getCommercialDomainContract(),
    };
  }

  let docs;
  try {
    docs = await prisma.crmCommercialDocument.findMany({});
  } catch {
    const honesty = applyCommercialReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      byCurrency: null,
      silentMultiCurrencySum: false,
      honesty: { ...honesty, currencySeparated: true },
      domain: getCommercialDomainContract(),
    };
  }

  const byCurrency = {};
  for (const doc of docs || []) {
    const currency = String(doc.currency || 'UNKNOWN').toUpperCase();
    if (!byCurrency[currency]) {
      byCurrency[currency] = {
        currency,
        documentCount: 0,
        // Never invent grand totals from missing pricing — null until snapshot joined
        quotedTotal: null,
      };
    }
    byCurrency[currency].documentCount += 1;
  }

  // Optionally enrich with version totals when present (still per-currency)
  if (typeof prisma.crmCommercialDocumentVersion?.findMany === 'function') {
    try {
      const versions = await prisma.crmCommercialDocumentVersion.findMany({});
      const docCurrency = new Map(
        (docs || []).map((d) => [d.id, String(d.currency || 'UNKNOWN').toUpperCase()])
      );
      for (const v of versions || []) {
        const currency =
          docCurrency.get(v.documentId) ||
          String(v.contentJson?.totals?.currency || '').toUpperCase();
        if (!currency || !byCurrency[currency]) continue;
        const grand = v.contentJson?.totals?.grandTotal;
        if (typeof grand === 'number' && !Number.isNaN(grand)) {
          byCurrency[currency].quotedTotal =
            (byCurrency[currency].quotedTotal || 0) + grand;
        }
      }
    } catch {
      // leave quotedTotal as-is; never invent
    }
  }

  return {
    ok: true,
    status: CRM_COMMERCIAL_REPORT_STATUS.READY,
    byCurrency,
    /** Explicitly absent — never sum ZAR+USD */
    silentMultiCurrencySum: false,
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      currencySeparated: true,
      kpiSafe: true,
    },
    hubs: {
      overview: true,
      myWork: true,
      approvals: true,
      expiring: true,
      responses: true,
      reports: true,
    },
    domain: getCommercialDomainContract(),
    definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
  };
}
