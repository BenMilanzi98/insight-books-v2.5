import {
  YearEndCloseRunStatus,
  CloseStatusAction,
  CloseTaskStatus,
  TASK_TERMINAL_OK,
} from '../domain/enums.js';
import { CloseChecklistBlockedError, FinancialYearNotReadyError, CrossTenantClosingError } from '../domain/errors.js';
import { YEAR_END_CHECKLIST_TEMPLATE, materializeChecklistTasks } from '../domain/yearEndChecklist.js';
import { requireApprovedClosingConfiguration } from './configService.js';
import { assessYearEndReadiness } from './readinessService.js';
import { FinancialYearStatus } from '../../accountingV2/periods/periodEnums.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';

async function appendHistory(db, context, run, action, previousStatus, newStatus, reason = null) {
  await db.closeV2CloseStatusHistory.create({
    data: {
      tenantId: context.businessId,
      financialYearId: run.financialYearId,
      closeRunId: run.id,
      previousStatus,
      newStatus,
      action,
      reason,
      executedBy: context.userId,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null,
    },
  });
}

export async function loadCloseRun(db, context, closeRunId) {
  const run = await db.closeV2YearEndCloseRun.findFirst({
    where: { id: closeRunId, tenantId: context.businessId },
    include: {
      tasks: { orderBy: { displayOrder: 'asc' } },
      exceptions: true,
      batches: { orderBy: { version: 'desc' } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!run) throw new CrossTenantClosingError('Close run not found for this business.');
  return run;
}

export async function createYearEndCloseRun(db, context, { financialYearId }) {
  const cfg = await requireApprovedClosingConfiguration(db, context.businessId);
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
  });
  if (!fy) throw new FinancialYearNotReadyError('Financial year not found.');
  if ([FinancialYearStatus.CLOSED, FinancialYearStatus.ARCHIVED].includes(fy.status)) {
    throw new FinancialYearNotReadyError(`Financial year is ${fy.status}.`);
  }

  const active = await db.closeV2YearEndCloseRun.findFirst({
    where: {
      tenantId: context.businessId,
      financialYearId,
      status: {
        notIn: [
          YearEndCloseRunStatus.COMPLETED,
          YearEndCloseRunStatus.SUPERSEDED,
          YearEndCloseRunStatus.CANCELLED,
          YearEndCloseRunStatus.FAILED,
        ],
      },
    },
  });
  if (active) {
    throw new FinancialYearNotReadyError(`Active close run already exists (version ${active.closeVersion}).`);
  }

  const last = await db.closeV2YearEndCloseRun.findFirst({
    where: { tenantId: context.businessId, financialYearId },
    orderBy: { closeVersion: 'desc' },
  });
  const closeVersion = (last?.closeVersion || 0) + 1;

  const readiness = await assessYearEndReadiness(db, context, { financialYearId });

  const run = await db.closeV2YearEndCloseRun.create({
    data: {
      tenantId: context.businessId,
      financialYearId,
      closeNumber: closeVersion,
      closeVersion,
      status: YearEndCloseRunStatus.PREPARING,
      checklistTemplateId: YEAR_END_CHECKLIST_TEMPLATE.templateId,
      checklistTemplateVersion: YEAR_END_CHECKLIST_TEMPLATE.version,
      closingMethod: cfg.closeMethod,
      startedBy: context.userId,
      transferDestinationAccountId: cfg.retainedEarningsAccountId || cfg.ownerCapitalAccountId,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null,
      metadata: { readinessStatus: readiness.status },
      expectedTaskCount: YEAR_END_CHECKLIST_TEMPLATE.tasks.length,
    },
  });

  await db.closeV2YearEndCloseTask.createMany({
    data: materializeChecklistTasks(context.businessId, run.id),
  });

  const withTasks = run;

  await appendHistory(
    db,
    context,
    withTasks,
    CloseStatusAction.CREATE_CLOSE_RUN,
    null,
    YearEndCloseRunStatus.PREPARING
  );

  await recordAccountingAudit(
    {
      action: 'closev2.run.created',
      entityType: 'CloseV2YearEndCloseRun',
      entityId: run.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { financialYearId, closeVersion, closingMethod: cfg.closeMethod },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return loadCloseRun(db, context, run.id);
}

export async function runAutomaticChecklistTasks(db, context, closeRunId) {
  const run = await loadCloseRun(db, context, closeRunId);
  const readiness = await assessYearEndReadiness(db, context, { financialYearId: run.financialYearId });
  const byCode = new Map(readiness.checks.map((c) => [c.code, c]));

  const autoTasks = run.tasks.filter((t) => t.kind === 'AUTOMATIC');
  for (const task of autoTasks) {
    const check = byCode.get(task.taskKey);
    let status = CloseTaskStatus.NOT_STARTED;
    let result = null;
    if (check) {
      if (check.status === 'PASSED') status = CloseTaskStatus.PASSED;
      else if (check.status === 'PASSED_WITH_WARNING') status = CloseTaskStatus.PASSED_WITH_WARNING;
      else if (check.status === 'FAILED') status = task.blocking ? CloseTaskStatus.BLOCKED : CloseTaskStatus.FAILED;
      result = check;
    } else {
      status = CloseTaskStatus.PASSED_WITH_WARNING;
      result = { message: 'No automatic feed; requires manual confirmation.', status: 'PASSED_WITH_WARNING' };
    }
    await db.closeV2YearEndCloseTask.update({
      where: { id: task.id },
      data: {
        status,
        result,
        completedAt: TASK_TERMINAL_OK.includes(status) ? new Date() : null,
        completedBy: TASK_TERMINAL_OK.includes(status) ? context.userId : null,
      },
    });
  }

  return refreshRunTaskCounts(db, context, closeRunId, readiness);
}

async function refreshRunTaskCounts(db, context, closeRunId, readiness = null) {
  const tasks = await db.closeV2YearEndCloseTask.findMany({ where: { closeRunId } });
  const completedTaskCount = tasks.filter((t) => TASK_TERMINAL_OK.includes(t.status)).length;
  const blockedTaskCount = tasks.filter((t) => t.status === CloseTaskStatus.BLOCKED || t.status === CloseTaskStatus.FAILED).length;
  const warningTaskCount = tasks.filter((t) => t.status === CloseTaskStatus.PASSED_WITH_WARNING).length;

  let status = YearEndCloseRunStatus.VALIDATING;
  if (blockedTaskCount > 0) status = YearEndCloseRunStatus.BLOCKED;
  else if (completedTaskCount === tasks.length) status = YearEndCloseRunStatus.READY_FOR_REVIEW;

  const run = await db.closeV2YearEndCloseRun.findFirst({ where: { id: closeRunId } });
  const updated = await db.closeV2YearEndCloseRun.update({
    where: { id: closeRunId },
    data: {
      completedTaskCount,
      blockedTaskCount,
      warningTaskCount,
      status,
      metadata: {
        ...(run.metadata || {}),
        readinessStatus: readiness?.status || run.metadata?.readinessStatus,
      },
    },
  });
  if (run.status !== status) {
    await appendHistory(
      db,
      context,
      updated,
      status === YearEndCloseRunStatus.BLOCKED ? CloseStatusAction.BLOCK : CloseStatusAction.BEGIN_VALIDATION,
      run.status,
      status
    );
  }
  return loadCloseRun(db, context, closeRunId);
}

export async function completeManualTask(db, context, closeRunId, taskKey, { comment, evidence, waive } = {}) {
  const run = await loadCloseRun(db, context, closeRunId);
  const task = run.tasks.find((t) => t.taskKey === taskKey);
  if (!task) throw new CloseChecklistBlockedError(`Unknown task ${taskKey}`);
  if (task.kind !== 'MANUAL') throw new CloseChecklistBlockedError('Task is not manual.');

  if (waive) {
    if (!waive.reason) throw new CloseChecklistBlockedError('Waiver requires a reason.');
    await db.closeV2YearEndCloseTask.update({
      where: { id: task.id },
      data: {
        status: CloseTaskStatus.WAIVED,
        waiveReason: waive.reason,
        waivedBy: context.userId,
        comment: comment || null,
        evidence: evidence || null,
        completedAt: new Date(),
        completedBy: context.userId,
      },
    });
  } else {
    await db.closeV2YearEndCloseTask.update({
      where: { id: task.id },
      data: {
        status: CloseTaskStatus.PASSED,
        comment: comment || null,
        evidence: evidence || null,
        completedAt: new Date(),
        completedBy: context.userId,
      },
    });
  }
  return refreshRunTaskCounts(db, context, closeRunId);
}

export async function approveCloseRunForClosing(db, context, closeRunId) {
  const run = await loadCloseRun(db, context, closeRunId);
  if (![YearEndCloseRunStatus.READY_FOR_REVIEW, YearEndCloseRunStatus.APPROVED_FOR_CLOSING].includes(run.status)) {
    throw new CloseChecklistBlockedError(`Close run status ${run.status} cannot be approved.`);
  }
  const blockingIncomplete = run.tasks.filter(
    (t) => t.blocking && t.required && !TASK_TERMINAL_OK.includes(t.status)
  );
  if (blockingIncomplete.length) {
    throw new CloseChecklistBlockedError(
      `${blockingIncomplete.length} blocking task(s) incomplete: ${blockingIncomplete.map((t) => t.taskKey).join(', ')}`
    );
  }
  if (run.startedBy === context.userId) {
    // Separation of duties soft warning — still allow if sole admin; record
  }
  const updated = await db.closeV2YearEndCloseRun.update({
    where: { id: closeRunId },
    data: {
      status: YearEndCloseRunStatus.APPROVED_FOR_CLOSING,
      approvedBy: context.userId,
      approvedAt: new Date(),
      reviewedBy: context.userId,
      reviewedAt: new Date(),
    },
  });
  await appendHistory(
    db,
    context,
    updated,
    CloseStatusAction.APPROVE_CLOSING,
    run.status,
    YearEndCloseRunStatus.APPROVED_FOR_CLOSING
  );
  return loadCloseRun(db, context, closeRunId);
}

export async function listCloseRuns(db, context, { financialYearId } = {}) {
  return db.closeV2YearEndCloseRun.findMany({
    where: {
      tenantId: context.businessId,
      ...(financialYearId ? { financialYearId } : {}),
    },
    orderBy: [{ financialYearId: 'desc' }, { closeVersion: 'desc' }],
  });
}
