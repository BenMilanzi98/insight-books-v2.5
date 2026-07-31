/**
 * Scheduled Activity reports — Phase 13 Wave 4.
 * Create / list / run with audit. Never invent KPI zeroes.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_ACTIVITY_REPORT_SCHEDULE_STATUS } from '../catalogue.js';
import { getActivityReport, CRM_ACTIVITY_REPORT_VERSION } from './reports.js';

export function hasCrmActivityReportScheduleModel(prisma) {
  return typeof prisma?.crmActivityReportSchedule?.create === 'function';
}

export function hasCrmActivityReportRunModel(prisma) {
  return typeof prisma?.crmActivityReportRun?.create === 'function';
}

function serializeSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || null,
    activityType: row.activityType || null,
    cronExpression: row.cronExpression || null,
    status: row.status,
    createdByAdminId: row.createdByAdminId || null,
    lastRunAt: row.lastRunAt ? new Date(row.lastRunAt).toISOString() : null,
    lastRunStatus: row.lastRunStatus || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function serializeRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    scheduleId: row.scheduleId || null,
    status: row.status,
    summaryJson: row.summaryJson ?? null,
    runByAdminId: row.runByAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   name: string,
 *   activityType?: string|null,
 *   cronExpression?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createActivityReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canEditActivities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_activity_report_schedule_forbidden' };
  }

  if (!hasCrmActivityReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const name = args.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'name_required' };

  const now = args.now || new Date();
  const row = await prisma.crmActivityReportSchedule.create({
    data: {
      name,
      activityType:
        args.activityType != null && String(args.activityType).trim()
          ? String(args.activityType).trim().toUpperCase()
          : null,
      cronExpression:
        args.cronExpression != null ? String(args.cronExpression).trim() : null,
      status: CRM_ACTIVITY_REPORT_SCHEDULE_STATUS.ACTIVE,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    schedule: serializeSchedule(row),
    meta: {
      audited: true,
      inventZeroesForbidden: true,
      definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, limit?: number|string }} args
 */
export async function listActivityReportSchedules(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canExport &&
    !access.canViewLeads
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_activity_report_schedule_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmActivityReportScheduleModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_activity_report_schedule_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.crmActivityReportSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeSchedule),
    meta: { count: (rows || []).length, inventZeroesForbidden: true },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, scheduleId: string, now?: Date }} args
 */
export async function runActivityReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canViewActivities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_activity_report_schedule_run_forbidden' };
  }

  const scheduleId = args.scheduleId ? String(args.scheduleId).trim() : '';
  if (!scheduleId) return { ok: false, error: 'scheduleId_required' };

  if (!hasCrmActivityReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let schedule = null;
  try {
    schedule = await prisma.crmActivityReportSchedule.findUnique({
      where: { id: scheduleId },
    });
  } catch {
    schedule = null;
  }
  if (!schedule) return { ok: false, notFound: true, error: 'schedule_not_found' };

  const now = args.now || new Date();
  const reportResult = await getActivityReport(prisma, {
    admin: args.admin,
    type: schedule.activityType || null,
  });

  const runStatus =
    reportResult.ok === false
      ? 'FAILED'
      : reportResult.status === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : reportResult.status === 'EMPTY'
          ? 'EMPTY'
          : 'OK';

  const summaryJson = {
    reportStatus: reportResult.status || null,
    honesty: reportResult.honesty || null,
    definitionVersion: CRM_ACTIVITY_REPORT_VERSION,
    inventZeroesForbidden: true,
    activityType: schedule.activityType || null,
    report:
      reportResult.report && reportResult.status === 'READY'
        ? {
            openCount: reportResult.report.openCount,
            completedCount: reportResult.report.completedCount,
            totalCount: reportResult.report.totalCount,
            byType: reportResult.report.byType,
          }
        : null,
  };

  let run = null;
  if (hasCrmActivityReportRunModel(prisma)) {
    try {
      run = await prisma.crmActivityReportRun.create({
        data: {
          scheduleId: schedule.id,
          status: runStatus,
          summaryJson,
          runByAdminId: args.admin?.id || null,
          at: now,
        },
      });
    } catch {
      run = null;
    }
  }

  try {
    await prisma.crmActivityReportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        lastRunStatus: runStatus,
        updatedAt: now,
      },
    });
  } catch {
    // best-effort
  }

  return {
    ok: true,
    schedule: serializeSchedule({
      ...schedule,
      lastRunAt: now,
      lastRunStatus: runStatus,
    }),
    run: serializeRun(run),
    report: reportResult,
    meta: { audited: Boolean(run), inventZeroesForbidden: true },
  };
}

export { serializeSchedule, serializeRun };
