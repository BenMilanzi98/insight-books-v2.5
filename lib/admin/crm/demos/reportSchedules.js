/**
 * Scheduled Demo reports — Phase 14 Wave 4.
 * Create / list / run with audit. Never invent KPI zeroes.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_DEMO_REPORT_SCHEDULE_STATUS, CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoReport, CRM_DEMO_REPORT_VERSION } from './reports.js';

export function hasCrmDemoReportScheduleModel(prisma) {
  return typeof prisma?.crmDemoReportSchedule?.create === 'function';
}

export function hasCrmDemoReportRunModel(prisma) {
  return typeof prisma?.crmDemoReportRun?.create === 'function';
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

export async function createDemoReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canEditActivities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_demo_report_schedule_forbidden' };
  }

  if (!hasCrmDemoReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const name = args.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'name_required' };

  const now = args.now || new Date();
  const row = await prisma.crmDemoReportSchedule.create({
    data: {
      name,
      cronExpression:
        args.cronExpression != null ? String(args.cronExpression).trim() : null,
      status: CRM_DEMO_REPORT_SCHEDULE_STATUS.ACTIVE,
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
      definitionVersion: CRM_DEMO_REPORT_VERSION,
    },
  };
}

export async function listDemoReportSchedules(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canExport &&
    !access.canViewLeads &&
    !access.canView
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_demo_report_schedule_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmDemoReportScheduleModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_demo_report_schedule_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.crmDemoReportSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeSchedule),
    meta: { count: (rows || []).length, inventZeroesForbidden: true, audited: true },
  };
}

export async function runDemoReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canEditActivities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_demo_report_schedule_run_forbidden' };
  }

  if (!hasCrmDemoReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const scheduleId = args.scheduleId ? String(args.scheduleId).trim() : '';
  if (!scheduleId) return { ok: false, error: 'scheduleId_required' };

  const schedule = await prisma.crmDemoReportSchedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) return { ok: false, notFound: true, error: 'schedule_not_found' };

  const now = args.now || new Date();
  const reportResult = await getDemoReport(prisma, { admin: args.admin });

  const runStatus =
    reportResult.forbidden
      ? 'FAILED'
      : reportResult.status === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : reportResult.status === 'EMPTY'
          ? 'EMPTY'
          : reportResult.ok
            ? 'READY'
            : 'FAILED';

  const summaryJson = {
    status: reportResult.status || runStatus,
    report: reportResult.report,
    honesty: reportResult.honesty,
    inventZeroesForbidden: true,
    definitionVersion: CRM_DEMO_REPORT_VERSION,
  };

  let run = null;
  if (hasCrmDemoReportRunModel(prisma)) {
    run = await prisma.crmDemoReportRun.create({
      data: {
        scheduleId: schedule.id,
        status: runStatus,
        summaryJson,
        runByAdminId: args.admin?.id || null,
        at: now,
      },
    });
  }

  await prisma.crmDemoReportSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      lastRunStatus: runStatus,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: schedule.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_REPORT_RUN,
    summary: `Demo report schedule run: ${runStatus}`,
    payload: {
      scheduleId: schedule.id,
      runStatus,
      inventZeroesForbidden: true,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    schedule: serializeSchedule({
      ...schedule,
      lastRunAt: now,
      lastRunStatus: runStatus,
    }),
    run: serializeRun(run),
    report: reportResult.report,
    status: reportResult.status || runStatus,
    honesty: reportResult.honesty,
    meta: {
      audited: true,
      inventZeroesForbidden: true,
      definitionVersion: CRM_DEMO_REPORT_VERSION,
    },
  };
}
