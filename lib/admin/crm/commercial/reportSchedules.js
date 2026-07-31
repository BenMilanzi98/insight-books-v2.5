/**
 * Scheduled commercial reports — Phase 15 Wave 4.
 * Create / list / run with audit. Never invent KPI zeroes.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_COMMERCIAL_REPORT_SCHEDULE_STATUS } from '../catalogue.js';
import {
  getCommercialReport,
  CRM_COMMERCIAL_REPORT_VERSION,
} from './reports.js';

export function hasCrmCommercialReportScheduleModel(prisma) {
  return typeof prisma?.crmCommercialReportSchedule?.create === 'function';
}

export function hasCrmCommercialReportRunModel(prisma) {
  return typeof prisma?.crmCommercialReportRun?.create === 'function';
}

function serializeSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || null,
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

export async function createCommercialReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.isSuperAdmin) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_commercial_report_schedule_forbidden',
    };
  }
  if (!hasCrmCommercialReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const name = args.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'name_required' };

  const now = args.now || new Date();
  const row = await prisma.crmCommercialReportSchedule.create({
    data: {
      name,
      cronExpression:
        args.cronExpression != null ? String(args.cronExpression).trim() : null,
      status: CRM_COMMERCIAL_REPORT_SCHEDULE_STATUS.ACTIVE,
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
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
    },
  };
}

export async function listCommercialReportSchedules(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewOpportunities &&
    !access.canExport &&
    !access.canView &&
    !access.isSuperAdmin
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_commercial_report_schedule_list_forbidden',
      items: [],
    };
  }
  if (!hasCrmCommercialReportScheduleModel(prisma)) {
    return { ok: true, items: [], status: 'UNAVAILABLE' };
  }
  const rows = await prisma.crmCommercialReportSchedule.findMany({});
  return { ok: true, items: rows.map(serializeSchedule) };
}

export async function runCommercialReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.isSuperAdmin) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_commercial_report_schedule_run_forbidden',
    };
  }
  if (!hasCrmCommercialReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scheduleId = args.scheduleId ? String(args.scheduleId).trim() : '';
  if (!scheduleId) return { ok: false, error: 'scheduleId_required' };

  const schedule = await prisma.crmCommercialReportSchedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) return { ok: false, notFound: true, error: 'schedule_not_found' };

  const reportResult = await getCommercialReport(prisma, { admin: args.admin });
  const runStatus =
    reportResult.status === 'UNAVAILABLE'
      ? 'UNAVAILABLE'
      : reportResult.status === 'EMPTY'
        ? 'EMPTY'
        : reportResult.ok
          ? 'READY'
          : 'FAILED';

  const now = args.now || new Date();
  let run = null;
  if (hasCrmCommercialReportRunModel(prisma)) {
    run = await prisma.crmCommercialReportRun.create({
      data: {
        scheduleId,
        status: runStatus,
        summaryJson: {
          reportStatus: reportResult.status,
          inventZeroesForbidden: true,
          falseZeroes: false,
          kpis: reportResult.report?.kpis ?? null,
        },
        runByAdminId: args.admin?.id || null,
        at: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await prisma.crmCommercialReportSchedule.update({
    where: { id: scheduleId },
    data: {
      lastRunAt: now,
      lastRunStatus: runStatus,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    schedule: serializeSchedule({
      ...schedule,
      lastRunAt: now,
      lastRunStatus: runStatus,
    }),
    run: serializeRun(run),
    report: reportResult,
    meta: {
      audited: true,
      inventZeroesForbidden: true,
      definitionVersion: CRM_COMMERCIAL_REPORT_VERSION,
    },
  };
}
