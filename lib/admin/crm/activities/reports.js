/**
 * Activity reporting centre — Phase 13 Wave 4.
 * Honesty-gated: metric gate fail → never fabricated zeroes (EMPTY/UNAVAILABLE).
 */

import { resolveCrmAccess, resolveCrmScope } from '../authz.js';
import {
  CRM_ACTIVITY_REPORT_STATUS,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_RELIABILITY_STATUS,
} from '../catalogue.js';
import { hasCrmActivityModel } from './model.js';

export const CRM_ACTIVITY_REPORT_VERSION = 'crm-activity-report-v1-2026-07-30';

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
 * Reliability gate for Activity metrics — fail closed to null KPIs.
 *
 * @param {{
 *   modelAvailable: boolean,
 *   queryOk: boolean,
 *   permissionOk: boolean,
 * }} gate
 */
export function applyActivityReportHonesty(gate = {}) {
  if (gate.permissionOk === false) {
    return {
      kpiSafe: false,
      status: CRM_ACTIVITY_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.PERMISSION_RESTRICTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.modelAvailable === false) {
    return {
      kpiSafe: false,
      status: CRM_ACTIVITY_REPORT_STATUS.UNAVAILABLE,
      reliability: CRM_RELIABILITY_STATUS.NOT_INSTRUMENTED,
      inventZeroesForbidden: true,
      falseZeroes: false,
    };
  }
  if (gate.queryOk === false) {
    return {
      kpiSafe: false,
      status: CRM_ACTIVITY_REPORT_STATUS.UNAVAILABLE,
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
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, type?: string|null }} args
 */
export async function getActivityReport(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities &&
    !access.canExport
  ) {
    const honesty = applyActivityReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_activity_report_forbidden',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    };
  }

  const scope = await resolveCrmScope(prisma, args.admin, 'leads');
  if (!scope.canView) {
    const honesty = applyActivityReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_scope_denied',
      status: honesty.status,
      report: null,
      honesty,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    };
  }

  if (!hasCrmActivityModel(prisma)) {
    const honesty = applyActivityReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      reason: 'crm_activity_model_unavailable',
      report: null,
      honesty,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    };
  }

  const typeFilter = args.type
    ? String(args.type).trim().toUpperCase()
    : null;

  const baseWhere = typeFilter ? { type: typeFilter } : {};

  const openCount = await safeCount(() =>
    prisma.crmActivity.count({
      where: { ...baseWhere, status: CRM_ACTIVITY_STATUS.OPEN },
    })
  );
  const completedCount = await safeCount(() =>
    prisma.crmActivity.count({
      where: { ...baseWhere, status: CRM_ACTIVITY_STATUS.COMPLETED },
    })
  );
  const totalCount = await safeCount(() =>
    prisma.crmActivity.count({ where: baseWhere })
  );

  const queryOk = openCount.ok && completedCount.ok && totalCount.ok;
  if (!queryOk) {
    const honesty = applyActivityReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      reason: 'activity_metric_gate_failed',
      report: null,
      honesty,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    };
  }

  if (totalCount.value === 0) {
    return {
      ok: true,
      status: CRM_ACTIVITY_REPORT_STATUS.EMPTY,
      report: {
        openCount: null,
        completedCount: null,
        totalCount: null,
        byType: null,
        plannedVsCompleted: null,
      },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        kpiSafe: false,
      },
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
      meta: {
        type: typeFilter,
        scopeMode: scope.mode,
        scopeStub: scope.stub === true,
      },
    };
  }

  const typeCodes = [
    CRM_ACTIVITY_TYPE.TASK,
    CRM_ACTIVITY_TYPE.FOLLOW_UP,
    CRM_ACTIVITY_TYPE.CALL,
    CRM_ACTIVITY_TYPE.EMAIL,
    CRM_ACTIVITY_TYPE.MEETING,
    CRM_ACTIVITY_TYPE.NOTE,
  ];
  const byType = Object.create(null);
  let byTypeOk = true;
  for (const code of typeCodes) {
    if (typeFilter && typeFilter !== code) {
      byType[code] = null;
      continue;
    }
    const c = await safeCount(() =>
      prisma.crmActivity.count({ where: { type: code } })
    );
    if (!c.ok) {
      byTypeOk = false;
      break;
    }
    byType[code] = c.value;
  }

  if (!byTypeOk) {
    const honesty = applyActivityReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      reason: 'activity_by_type_gate_failed',
      report: null,
      honesty,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    };
  }

  return {
    ok: true,
    status: CRM_ACTIVITY_REPORT_STATUS.READY,
    report: {
      openCount: openCount.value,
      completedCount: completedCount.value,
      totalCount: totalCount.value,
      byType,
      plannedVsCompleted: {
        open: openCount.value,
        completed: completedCount.value,
        note: 'Planned/open ≠ completed; delivery/reminder never invents completion',
      },
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      emptyEnvelope: false,
      kpiSafe: true,
      telephonyVolumeInvented: false,
      externalCalendarSyncInvented: false,
    },
    definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    meta: {
      type: typeFilter,
      scopeMode: scope.mode,
      scopeStub: scope.stub === true,
    },
  };
}
