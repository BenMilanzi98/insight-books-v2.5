/**
 * Demo reporting centre — Phase 14 Wave 4.
 * Honesty-gated: metric gate fail → never fabricated zeroes (EMPTY/UNAVAILABLE).
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  CRM_DEMO_REPORT_STATUS,
  CRM_DEMO_STATUS,
  CRM_RELIABILITY_STATUS,
} from '../catalogue.js';
import { hasCrmDemoModel } from './model.js';
import { getDemoDomainContract } from './catalogue.js';

export const CRM_DEMO_REPORT_VERSION = 'crm-demo-report-v1-2026-07-30';

async function safeCount(fn) {
  try {
    const value = await fn();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { ok: false, value: null };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * Reliability gate for Demo metrics — fail closed to null KPIs.
 */
export function applyDemoReportHonesty(gate = {}) {
  if (gate.permissionOk === false) {
    return {
      kpiSafe: false,
      status: CRM_DEMO_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.modelAvailable === false) {
    return {
      kpiSafe: false,
      status: CRM_DEMO_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.queryOk === false) {
    return {
      kpiSafe: false,
      status: CRM_DEMO_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  return {
    kpiSafe: true,
    inventZeroesForbidden: true,
    falseZeroes: false,
  };
}

/**
 * Demo metrics + reliability gate.
 * Never invent Demo volume from Lead DEMO_REQUEST counts alone.
 */
export async function getDemoReport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canExport &&
    !access.canView
  ) {
    const honesty = applyDemoReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_demo_report_forbidden',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_DEMO_REPORT_VERSION,
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'leads');
  if (!scope.canView) {
    const honesty = applyDemoReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_scope_denied',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_DEMO_REPORT_VERSION,
    };
  }

  if (!hasCrmDemoModel(prisma)) {
    const honesty = applyDemoReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_demo_model_unavailable',
      report: null,
      honesty,
      definitionVersion: CRM_DEMO_REPORT_VERSION,
      domain: getDemoDomainContract(),
    };
  }

  const scheduled = await safeCount(() =>
    prisma.crmDemo.count({
      where: { status: CRM_DEMO_STATUS.SCHEDULED },
    })
  );
  const ready = await safeCount(() =>
    prisma.crmDemo.count({
      where: { status: CRM_DEMO_STATUS.READY_TO_DELIVER },
    })
  );
  const inDelivery = await safeCount(() =>
    prisma.crmDemo.count({
      where: { status: CRM_DEMO_STATUS.IN_DELIVERY },
    })
  );
  const delivered = await safeCount(() =>
    prisma.crmDemo.count({
      where: {
        status: {
          in: [
            CRM_DEMO_STATUS.DELIVERED,
            CRM_DEMO_STATUS.OUTCOME_RECORDED,
            CRM_DEMO_STATUS.FOLLOW_UP_PENDING,
          ],
        },
      },
    })
  );
  const total = await safeCount(() => prisma.crmDemo.count());

  const queryOk =
    scheduled.ok && ready.ok && inDelivery.ok && delivered.ok && total.ok;
  if (!queryOk) {
    const honesty = applyDemoReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_demo_report_query_failed',
      report: null,
      honesty,
      definitionVersion: CRM_DEMO_REPORT_VERSION,
      domain: getDemoDomainContract(),
    };
  }

  const honesty = applyDemoReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  if (total.value === 0) {
    return {
      ok: true,
      status: CRM_DEMO_REPORT_STATUS.EMPTY,
      report: {
        kpis: {
          total: 0,
          scheduled: 0,
          readyToDeliver: 0,
          inDelivery: 0,
          delivered: 0,
        },
        empty: true,
        leadDemoRequestNotUsedAsVolume: true,
      },
      honesty: {
        ...honesty,
        reliability: CRM_RELIABILITY_STATUS.AVAILABLE,
      },
      definitionVersion: CRM_DEMO_REPORT_VERSION,
      domain: getDemoDomainContract(),
    };
  }

  return {
    ok: true,
    status: CRM_DEMO_REPORT_STATUS.READY,
    report: {
      kpis: {
        total: total.value,
        scheduled: scheduled.value,
        readyToDeliver: ready.value,
        inDelivery: inDelivery.value,
        delivered: delivered.value,
      },
      empty: false,
      leadDemoRequestNotUsedAsVolume: true,
      scopeMode: scope.mode || 'all',
      scopeAccurate: scope.mode !== 'all' ? true : false,
    },
    honesty: {
      ...honesty,
      reliability: CRM_RELIABILITY_STATUS.AVAILABLE,
    },
    definitionVersion: CRM_DEMO_REPORT_VERSION,
    domain: getDemoDomainContract(),
  };
}
