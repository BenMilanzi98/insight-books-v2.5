/**
 * Scheduled Pipeline reports — Phase 12 Wave 4.
 * Create / list / run (stub-capable) with audit. Never invent KPI zeroes.
 */

import { resolveCrmAccess } from '../authz.js';
import { CRM_PIPELINE_CODES } from '../pipeline/catalogue.js';
import {
  WEIGHTED_PIPELINE_UI_ENABLED,
  resolveWeightedPipelineUiAccess,
} from './commercial.js';

function weightedUiMeta() {
  return resolveWeightedPipelineUiAccess({}).unlocked;
}
import { getPipelineReport, CRM_PIPELINE_REPORT_VERSION } from './reports.js';

export const CRM_PIPELINE_REPORT_SCHEDULE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
});

export function hasCrmPipelineReportScheduleModel(prisma) {
  return typeof prisma?.crmPipelineReportSchedule?.create === 'function';
}

export function hasCrmPipelineReportRunModel(prisma) {
  return typeof prisma?.crmPipelineReportRun?.create === 'function';
}

function serializeSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || null,
    pipelineCode: row.pipelineCode || null,
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
 *   pipelineCode?: string|null,
 *   cronExpression?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createPipelineReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canManagePipelineDefinitions) {
    return { ok: false, forbidden: true, reason: 'crm_report_schedule_forbidden' };
  }

  if (!hasCrmPipelineReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_pipeline_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const name = args.name != null ? String(args.name).trim() : '';
  if (!name) return { ok: false, error: 'name_required' };

  let pipelineCode = null;
  if (args.pipelineCode != null && String(args.pipelineCode).trim()) {
    pipelineCode = String(args.pipelineCode).trim().toUpperCase();
    if (!CRM_PIPELINE_CODES.includes(pipelineCode)) {
      return { ok: false, error: 'invalid_pipeline_code', allowed: CRM_PIPELINE_CODES };
    }
  }

  const now = args.now || new Date();
  const row = await prisma.crmPipelineReportSchedule.create({
    data: {
      name,
      pipelineCode,
      cronExpression:
        args.cronExpression != null ? String(args.cronExpression).trim() : null,
      status: CRM_PIPELINE_REPORT_SCHEDULE_STATUS.ACTIVE,
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
      weightedUiEnabled: weightedUiMeta(),
      definitionVersion: CRM_PIPELINE_REPORT_VERSION,
    },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, limit?: number|string }} args
 */
export async function listPipelineReportSchedules(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canViewPipeline && !access.canExport) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_report_schedule_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmPipelineReportScheduleModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: {
        unavailable: true,
        reason: 'crm_pipeline_report_schedule_model_unavailable',
        status: 'UNAVAILABLE',
      },
    };
  }

  const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.crmPipelineReportSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeSchedule),
    meta: {
      count: (rows || []).length,
      limit,
      weightedUiEnabled: weightedUiMeta(),
    },
  };
}

/**
 * Run a scheduled Pipeline report (immediate execution + audit row).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, scheduleId: string, now?: Date }} args
 */
export async function runPipelineReportSchedule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canExport && !access.canViewPipeline) {
    return { ok: false, forbidden: true, reason: 'crm_report_schedule_run_forbidden' };
  }

  const scheduleId = args.scheduleId ? String(args.scheduleId).trim() : '';
  if (!scheduleId) return { ok: false, error: 'scheduleId_required' };

  if (!hasCrmPipelineReportScheduleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_pipeline_report_schedule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let schedule = null;
  try {
    schedule = await prisma.crmPipelineReportSchedule.findUnique({
      where: { id: scheduleId },
    });
  } catch {
    schedule = null;
  }
  if (!schedule) return { ok: false, notFound: true, error: 'schedule_not_found' };

  const now = args.now || new Date();
  const reportResult = await getPipelineReport(prisma, {
    admin: args.admin,
    pipelineCode: schedule.pipelineCode || null,
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
    definitionVersion: CRM_PIPELINE_REPORT_VERSION,
    weightedUiEnabled: weightedUiMeta(),
    inventZeroesForbidden: true,
    pipelineCode: schedule.pipelineCode || null,
    // Store counts only when present — never invent zeroes from empty
    report:
      reportResult.report && reportResult.status === 'READY'
        ? {
            winCount: reportResult.report.winCount,
            lossCount: reportResult.report.lossCount,
            openCount: reportResult.report.openCount,
            totalCount: reportResult.report.totalCount,
            openPipelineByCurrency: reportResult.report.openPipelineByCurrency,
          }
        : null,
  };

  let run = null;
  if (hasCrmPipelineReportRunModel(prisma)) {
    try {
      run = await prisma.crmPipelineReportRun.create({
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
    await prisma.crmPipelineReportSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        lastRunStatus: runStatus,
        updatedAt: now,
      },
    });
  } catch {
    // schedule update best-effort
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
    meta: {
      audited: Boolean(run),
      weightedUiEnabled: weightedUiMeta(),
    },
  };
}

export { serializeSchedule, serializeRun };
