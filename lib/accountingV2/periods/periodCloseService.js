/**
 * Phase 8 — Period Close Run workflow (§25–§35).
 *
 * Begin close → automated checks + manual tasks → exceptions → submit for
 * review → approve (separation of duties) → atomic closure with snapshots,
 * immutable status history and outbox notification. Re-closing a reopened
 * period creates a new close-run version; previous runs are superseded,
 * never overwritten or deleted.
 */

import { AccountingValidationError } from '../domain/errors.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { enqueueOutboxMessage } from '../infrastructure/outbox.js';
import { normalizeReportRequest, TRIAL_BALANCE_STATUS, REPORT_INTEGRITY_STATUS } from '../reporting/reportContracts.js';
import { generateTrialBalance } from '../reporting/trialBalanceService.js';
import { runReportReconciliation, generateUnmappedAccountReport } from '../reporting/reportValidationService.js';
import { generateReport } from '../reporting/financialReportService.js';
import { snapshotReport } from '../reporting/reportRunService.js';
import { getCalendarConfig } from './calendarConfigService.js';
import { getChecklistTemplate, CLOSE_TASK_KIND } from './periodCloseChecklist.js';
import { getPeriodForBusiness, transitionPeriod } from './periodLifecycleService.js';
import { toDateOnly, isoDate } from './periodGeneration.js';
import {
  AccountingPeriodStatus,
  CloseRunStatus,
  CloseTaskStatus,
  CloseExceptionStatus,
  PeriodStatusAction,
  TASK_TERMINAL_OK,
} from './periodEnums.js';
const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/** Exception categories that can never be accepted for closure (§31). */
export const ALWAYS_BLOCKING_EXCEPTION_CATEGORIES = Object.freeze([
  'CROSS_TENANT_REFERENCE',
  'UNBALANCED_POSTED_JOURNAL',
  'DUPLICATE_ACTIVE_POSTING',
  'MISSING_BUSINESS_OWNERSHIP',
  'FOREIGN_BUSINESS_DATA',
  'POSTED_JOURNAL_MISSING_ACCOUNT',
  'TRIAL_BALANCE_SYSTEM_DEFECT',
  'UNSUPPORTED_MATERIAL_LIABILITY',
  'MISSING_HIGH_RISK_AUTHORIZATION',
]);

const ACTIVE_RUN_STATUSES = [
  CloseRunStatus.DRAFT,
  CloseRunStatus.IN_PROGRESS,
  CloseRunStatus.BLOCKED,
  CloseRunStatus.READY_FOR_REVIEW,
  CloseRunStatus.APPROVED,
];

/** Load a close run with business scope enforced. */
export async function getCloseRun(db, context, closeRunId, { includeTasks = true } = {}) {
  const run = await db.acctV2PeriodCloseRun.findFirst({
    where: { id: closeRunId, tenantId: context.businessId },
  });
  if (!run) throw new AccountingValidationError('Close run not found for this business.', ids(context));
  if (!includeTasks) return { run, tasks: [] };
  const tasks = await db.acctV2PeriodCloseTask.findMany({
    where: { closeRunId: run.id, tenantId: context.businessId },
    orderBy: { displayOrder: 'asc' },
  });
  return { run, tasks };
}

/** The single active close run for a period, if any. */
export async function getActiveCloseRun(db, context, periodId) {
  return db.acctV2PeriodCloseRun.findFirst({
    where: {
      tenantId: context.businessId,
      accountingPeriodId: periodId,
      status: { in: ACTIVE_RUN_STATUSES },
    },
    orderBy: { closeNumber: 'desc' },
  });
}

/**
 * Begin closing a period (OPEN → CLOSING, or REOPENED → CLOSING for a
 * re-close). Creates a versioned close run and materializes the checklist.
 */
export async function beginPeriodClose(db, context, periodId, { reason = null } = {}) {
  const period = await getPeriodForBusiness(db, context, periodId);
  if (![AccountingPeriodStatus.OPEN, AccountingPeriodStatus.REOPENED].includes(period.status)) {
    throw new AccountingValidationError(
      `Close can only begin for an OPEN or REOPENED period (current: ${period.status}).`,
      ids(context)
    );
  }
  const existing = await getActiveCloseRun(db, context, period.id);
  if (existing) {
    throw new AccountingValidationError(
      `A close run (#${existing.closeNumber}, ${existing.status}) is already active for ${period.name}.`,
      ids(context)
    );
  }
  const config = await getCalendarConfig(db, context);
  const template = getChecklistTemplate(config.checklistTemplateId, config.checklistTemplateVersion);
  const isReclose = period.status === AccountingPeriodStatus.REOPENED;

  const previousRuns = await db.acctV2PeriodCloseRun.findMany({
    where: { tenantId: context.businessId, accountingPeriodId: period.id },
    orderBy: { closeNumber: 'desc' },
  });
  const closeNumber = (previousRuns[0]?.closeNumber ?? 0) + 1;

  const created = await db.$transaction(async (tx) => {
    const run = await tx.acctV2PeriodCloseRun.create({
      data: {
        tenantId: context.businessId,
        financialYearId: period.financialYearId,
        accountingPeriodId: period.id,
        closeNumber,
        status: CloseRunStatus.IN_PROGRESS,
        checklistTemplateId: template.templateId,
        checklistTemplateVersion: template.version,
        initiatedBy: context.userId,
        expectedTaskCount: template.tasks.length,
        reason,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? null,
        metadata: { previousPeriodStatus: period.status, isReclose },
      },
    });
    let order = 0;
    for (const task of template.tasks) {
      order += 10;
      await tx.acctV2PeriodCloseTask.create({
        data: {
          tenantId: context.businessId,
          closeRunId: run.id,
          taskKey: task.taskKey,
          name: task.name,
          module: task.module,
          kind: task.kind,
          blocking: task.blocking,
          required: task.required,
          displayOrder: order,
          status: CloseTaskStatus.NOT_STARTED,
        },
      });
    }
    await transitionPeriod(tx, context, period, AccountingPeriodStatus.CLOSING,
      isReclose ? PeriodStatusAction.BEGIN_RECLOSE : PeriodStatusAction.BEGIN_CLOSE,
      { reason, extraData: { currentCloseRunId: run.id } });
    return run;
  });

  await recordAccountingAudit(
    {
      action: 'acctv2.period.beginClose',
      entityType: 'AcctV2PeriodCloseRun',
      entityId: created.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { periodId: period.id, closeNumber, template: `${template.templateId}@${template.version}` },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return created;
}

/** Cancel an active close: run → CANCELLED, period returns to its previous status. */
export async function cancelPeriodClose(db, context, closeRunId, { reason = null } = {}) {
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  if (!ACTIVE_RUN_STATUSES.includes(run.status) || run.status === CloseRunStatus.APPROVED) {
    throw new AccountingValidationError(`Cannot cancel a close run in status ${run.status}.`, ids(context));
  }
  const period = await getPeriodForBusiness(db, context, run.accountingPeriodId);
  const previousStatus = run.metadata?.previousPeriodStatus === AccountingPeriodStatus.REOPENED
    ? AccountingPeriodStatus.REOPENED
    : AccountingPeriodStatus.OPEN;

  return db.$transaction(async (tx) => {
    const cancelled = await tx.acctV2PeriodCloseRun.update({
      where: { id: run.id },
      data: { status: CloseRunStatus.CANCELLED, completedAt: new Date() },
    });
    await transitionPeriod(tx, context, period, previousStatus, PeriodStatusAction.CANCEL_CLOSE, {
      reason,
      extraData: { currentCloseRunId: null },
    });
    return cancelled;
  });
}

/** Build the canonical report request for the close period window. */
async function buildPeriodReportRequest(db, context, period) {
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: period.financialYearId, tenantId: context.businessId },
  });
  return normalizeReportRequest(context, 'TRIAL_BALANCE', {
    fromDate: isoDate(toDateOnly(period.startDate)),
    toDate: isoDate(toDateOnly(period.endDate)),
    asOfDate: isoDate(toDateOnly(period.endDate)),
    financialYearStartDate: fy ? isoDate(toDateOnly(fy.startDate)) : undefined,
  });
}

/**
 * Execute every AUTOMATIC checklist task against canonical services and
 * record the results. Sets the run BLOCKED when a blocking check fails.
 */
export async function runAutomatedCloseChecks(db, context, closeRunId) {
  const { run, tasks } = await getCloseRun(db, context, closeRunId);
  if (![CloseRunStatus.IN_PROGRESS, CloseRunStatus.BLOCKED].includes(run.status)) {
    throw new AccountingValidationError(`Automated checks cannot run in status ${run.status}.`, ids(context));
  }
  const period = await getPeriodForBusiness(db, context, run.accountingPeriodId);
  const request = await buildPeriodReportRequest(db, context, period);
  const windowStart = toDateOnly(period.startDate);
  const windowEnd = toDateOnly(period.endDate);

  // Canonical inputs (Phase 5/6/7 services — no independent totals).
  const [tb, recon, unmapped, inFlightCount, draftCount, failedCount, v2Journals, openExceptions] = await Promise.all([
    generateTrialBalance(db, context, request),
    runReportReconciliation(db, context, request),
    generateUnmappedAccountReport(db, context, request),
    db.journalEntry.count({ where: { tenantId: context.businessId, status: 'POSTING' } }),
    db.journalEntry.count({
      where: {
        tenantId: context.businessId,
        status: { in: ['DRAFT', 'Draft'] },
        entryDate: { gte: windowStart, lte: new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000 - 1) },
      },
    }),
    db.acctV2EventRegistry ? db.acctV2EventRegistry.count({ where: { tenantId: context.businessId, status: 'FAILED' } }) : 0,
    db.journalEntry.findMany({
      where: {
        tenantId: context.businessId,
        architectureVersion: 'ACCOUNTING_V2',
        status: { in: ['POSTED', 'Posted'] },
        postingDate: { gte: windowStart, lte: new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000 - 1) },
      },
      select: { id: true, totalDebit: true, totalCredit: true },
    }),
    db.acctV2PeriodCloseException.findMany({
      where: {
        tenantId: context.businessId,
        accountingPeriodId: period.id,
        status: { in: [CloseExceptionStatus.OPEN, CloseExceptionStatus.UNDER_REVIEW] },
      },
    }),
  ]);

  const unbalanced = v2Journals.filter((j) => Number(j.totalDebit ?? 0) !== Number(j.totalCredit ?? 0));
  const reconCodes = new Set(recon.findings.map((f) => f.code));
  const blockingExceptions = openExceptions.filter((e) => ['HIGH', 'CRITICAL'].includes(String(e.severity).toUpperCase()));

  const reportsBlocked = Object.values(recon.reports).some(
    (r) => r.integrity === REPORT_INTEGRITY_STATUS.BLOCKED
  );

  const outcome = (ok, warn = false) =>
    ok ? (warn ? CloseTaskStatus.PASSED_WITH_WARNING : CloseTaskStatus.PASSED) : CloseTaskStatus.FAILED;

  /** taskKey → {status, result} computed exclusively from canonical outputs. */
  const results = {
    TB_BALANCED: {
      status: outcome(
        tb.trialBalanceStatus === TRIAL_BALANCE_STATUS.BALANCED ||
          tb.trialBalanceStatus === TRIAL_BALANCE_STATUS.BALANCED_WITH_WARNINGS,
        tb.trialBalanceStatus === TRIAL_BALANCE_STATUS.BALANCED_WITH_WARNINGS
      ),
      result: {
        rule: 'TRIAL_BALANCE_STATUS',
        expected: TRIAL_BALANCE_STATUS.BALANCED,
        actual: tb.trialBalanceStatus,
        difference: tb.totals?.difference?.decimal ?? null,
      },
    },
    JOURNALS_BALANCED: {
      status: outcome(unbalanced.length === 0),
      result: { rule: 'UNBALANCED_V2_JOURNALS', expected: 0, actual: unbalanced.length, evidence: unbalanced.slice(0, 20).map((j) => j.id) },
    },
    NO_POSTING_IN_FLIGHT: {
      status: outcome(inFlightCount === 0),
      result: { rule: 'JOURNALS_IN_POSTING_STATE', expected: 0, actual: inFlightCount },
    },
    NO_FAILED_POSTINGS: {
      status: outcome(Number(failedCount) === 0),
      result: { rule: 'FAILED_POSTING_EVENTS', expected: 0, actual: Number(failedCount) },
    },
    DRAFT_JOURNALS_REVIEWED: {
      status: outcome(draftCount === 0),
      result: { rule: 'DRAFT_JOURNALS_IN_PERIOD', expected: 0, actual: draftCount },
    },
    BS_EQUATION: {
      status: outcome(!reconCodes.has('REP-003')),
      result: { rule: 'REP-003', expected: 'balanced', actual: reconCodes.has('REP-003') ? 'unbalanced' : 'balanced' },
    },
    GL_RECONCILIATION: {
      status: outcome(
        recon.overallStatus !== REPORT_INTEGRITY_STATUS.UNVERIFIED,
        recon.overallStatus === REPORT_INTEGRITY_STATUS.VERIFIED_WITH_WARNINGS
      ),
      result: { rule: 'REPORT_RECONCILIATION', expected: 'VERIFIED', actual: recon.overallStatus, evidence: recon.findings.slice(0, 20) },
    },
    AR_CONTROL_RECONCILED: {
      status: outcome(!reconCodes.has('REP-006')),
      result: { rule: 'REP-006', expected: 'reconciled', actual: reconCodes.has('REP-006') ? 'difference' : 'reconciled' },
    },
    AP_CONTROL_RECONCILED: {
      status: outcome(!reconCodes.has('REP-007')),
      result: { rule: 'REP-007', expected: 'reconciled', actual: reconCodes.has('REP-007') ? 'difference' : 'reconciled' },
    },
    OPEN_EXCEPTIONS_RESOLVED: {
      status: outcome(blockingExceptions.length === 0, openExceptions.length > 0),
      result: {
        rule: 'OPEN_PERIOD_EXCEPTIONS',
        expected: 0,
        actual: openExceptions.length,
        evidence: blockingExceptions.slice(0, 20).map((e) => e.id),
      },
    },
    REPORTS_GENERATED: {
      status: outcome(!reportsBlocked),
      result: {
        rule: 'STATEMENT_GENERATION',
        expected: 'generated',
        actual: reportsBlocked ? 'BLOCKED' : 'generated',
        evidence: Object.fromEntries(Object.entries(recon.reports).map(([k, v]) => [k, v.integrity])),
      },
    },
    UNMAPPED_ACCOUNTS: {
      status: outcome(unmapped.count === 0, false),
      result: { rule: 'UNMAPPED_ACCOUNT_BALANCES', expected: 0, actual: unmapped.count },
    },
    CASH_FLOW_RECONCILED: {
      status: outcome(!reconCodes.has('REP-004')),
      result: { rule: 'REP-004', expected: 'reconciled', actual: reconCodes.has('REP-004') ? 'difference' : 'reconciled' },
    },
    EQUITY_RECONCILED: {
      status: outcome(!reconCodes.has('REP-005')),
      result: { rule: 'REP-005', expected: 'reconciled', actual: reconCodes.has('REP-005') ? 'difference' : 'reconciled' },
    },
  };

  // Phase 10 — live bank reconciliation feed (AUTOMATIC on checklist v1.1.0+)
  const bankTask = tasks.find(
    (task) => task.taskKey === 'BANK_RECONCILIATION_REVIEWED' && task.kind === CLOSE_TASK_KIND.AUTOMATIC
  );
  if (bankTask) {
    try {
      const { evaluateBankReconciliationClose } = await import(
        '../../bankReconciliation/application/periodCloseFeed.js'
      );
      const bankReconFeed = await evaluateBankReconciliationClose(db, context, period);
      if (bankReconFeed.automatic) {
        results.BANK_RECONCILIATION_REVIEWED = {
          status: outcome(bankReconFeed.ok, bankReconFeed.warning),
          result: bankReconFeed.result,
        };
      } else {
        results.BANK_RECONCILIATION_REVIEWED = {
          status: CloseTaskStatus.PASSED_WITH_WARNING,
          result: bankReconFeed.result,
        };
      }
    } catch (err) {
      results.BANK_RECONCILIATION_REVIEWED = {
        status: CloseTaskStatus.FAILED,
        result: {
          rule: 'BANK_RECONCILIATION_REVIEWED',
          mode: 'FEED_ERROR',
          message: err?.message || 'Bank reconciliation feed failed',
        },
      };
    }
  }

  const executedAt = new Date().toISOString();
  for (const task of tasks) {
    if (task.kind !== CLOSE_TASK_KIND.AUTOMATIC) continue;
    const computed = results[task.taskKey];
    if (!computed) continue;
    // Non-blocking automated tasks report failures as warnings, not blockers.
    const status =
      computed.status === CloseTaskStatus.FAILED && !task.blocking
        ? CloseTaskStatus.PASSED_WITH_WARNING
        : computed.status;
    await db.acctV2PeriodCloseTask.update({
      where: { id: task.id },
      data: {
        status,
        result: { ...computed.result, executedAt, severity: task.blocking ? 'BLOCKING' : 'WARNING' },
        completedBy: 'SYSTEM',
        completedAt: new Date(),
      },
    });
  }

  const refreshed = await db.acctV2PeriodCloseTask.findMany({
    where: { closeRunId: run.id, tenantId: context.businessId },
  });
  const blockingFailed = refreshed.filter((task) => task.blocking && task.status === CloseTaskStatus.FAILED);
  const completed = refreshed.filter((task) => TASK_TERMINAL_OK.includes(task.status));
  const warnings = refreshed.filter((task) => task.status === CloseTaskStatus.PASSED_WITH_WARNING);

  const updatedRun = await db.acctV2PeriodCloseRun.update({
    where: { id: run.id },
    data: {
      status: blockingFailed.length > 0 ? CloseRunStatus.BLOCKED : CloseRunStatus.IN_PROGRESS,
      completedTaskCount: completed.length,
      blockedTaskCount: blockingFailed.length,
      warningTaskCount: warnings.length,
      trialBalanceStatus: tb.trialBalanceStatus,
      reportStatus: recon.overallStatus,
      integrityStatus: blockingFailed.length > 0 ? 'BLOCKED' : recon.overallStatus,
    },
  });
  return { run: updatedRun, results, findings: recon.findings };
}

const MANUAL_TASK_STATUSES = [
  CloseTaskStatus.IN_PROGRESS,
  CloseTaskStatus.PASSED,
  CloseTaskStatus.PASSED_WITH_WARNING,
  CloseTaskStatus.FAILED,
  CloseTaskStatus.NOT_APPLICABLE,
];

/** Complete or update a MANUAL checklist task with evidence. */
export async function updateManualCloseTask(db, context, closeRunId, taskKey, { status, comment = null, evidence = null }) {
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  if (![CloseRunStatus.IN_PROGRESS, CloseRunStatus.BLOCKED].includes(run.status)) {
    throw new AccountingValidationError(`Tasks cannot be updated in run status ${run.status}.`, ids(context));
  }
  const task = await db.acctV2PeriodCloseTask.findFirst({
    where: { closeRunId: run.id, taskKey, tenantId: context.businessId },
  });
  if (!task) throw new AccountingValidationError(`Unknown close task: ${taskKey}.`, ids(context));
  if (task.kind !== CLOSE_TASK_KIND.MANUAL) {
    throw new AccountingValidationError(`Task ${taskKey} is automated and cannot be completed manually.`, ids(context));
  }
  if (!MANUAL_TASK_STATUSES.includes(status)) {
    throw new AccountingValidationError(`Invalid manual task status: ${status}.`, ids(context));
  }
  if ([CloseTaskStatus.PASSED, CloseTaskStatus.PASSED_WITH_WARNING].includes(status) && !evidence && !comment) {
    throw new AccountingValidationError(
      `Task ${taskKey} requires evidence or a review comment before it can be marked complete.`,
      ids(context)
    );
  }
  return db.acctV2PeriodCloseTask.update({
    where: { id: task.id },
    data: { status, comment, evidence, completedBy: context.userId, completedAt: new Date() },
  });
}

/**
 * Waive a task. Blocking tasks may only be waived by a caller holding the
 * materiality-override permission (verified via `can`), with reason recorded.
 */
export async function waiveCloseTask(db, context, closeRunId, taskKey, { reason, can }) {
  if (!reason) throw new AccountingValidationError('A waiver requires a reason and risk acknowledgement.', ids(context));
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  const task = await db.acctV2PeriodCloseTask.findFirst({
    where: { closeRunId: run.id, taskKey, tenantId: context.businessId },
  });
  if (!task) throw new AccountingValidationError(`Unknown close task: ${taskKey}.`, ids(context));
  if (task.blocking && !(can && can('accountingPeriods.overrideMateriality'))) {
    throw new AccountingValidationError(
      `Blocking task ${taskKey} can only be waived with the materiality-override permission.`,
      ids(context)
    );
  }
  const updated = await db.acctV2PeriodCloseTask.update({
    where: { id: task.id },
    data: { status: CloseTaskStatus.WAIVED, waivedBy: context.userId, waiveReason: reason },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.period.taskWaived',
      entityType: 'AcctV2PeriodCloseTask',
      entityId: task.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: { status: task.status, blocking: task.blocking },
      newValues: { status: CloseTaskStatus.WAIVED },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Record a period close exception. */
export async function addCloseException(db, context, periodId, params) {
  const period = await getPeriodForBusiness(db, context, periodId);
  if (!params.category || !params.description) {
    throw new AccountingValidationError('Exception requires a category and description.', ids(context));
  }
  return db.acctV2PeriodCloseException.create({
    data: {
      tenantId: context.businessId,
      financialYearId: period.financialYearId,
      accountingPeriodId: period.id,
      closeRunId: params.closeRunId ?? null,
      taskKey: params.taskKey ?? null,
      category: params.category,
      severity: params.severity ?? 'MEDIUM',
      amountMinor: params.amountMinor != null ? BigInt(params.amountMinor) : null,
      currency: params.currency ?? 'MWK',
      description: params.description,
      rootCause: params.rootCause ?? null,
      evidence: params.evidence ?? null,
      status: CloseExceptionStatus.OPEN,
    },
  });
}

/**
 * Accept an exception for closure. Always-blocking categories are refused;
 * acceptance is audited and the exception stays visible on snapshots.
 */
export async function acceptExceptionForClose(db, context, exceptionId, { reason, can }) {
  if (!reason) throw new AccountingValidationError('Accepting an exception requires a reason.', ids(context));
  const exception = await db.acctV2PeriodCloseException.findFirst({
    where: { id: exceptionId, tenantId: context.businessId },
  });
  if (!exception) throw new AccountingValidationError('Exception not found for this business.', ids(context));
  if (ALWAYS_BLOCKING_EXCEPTION_CATEGORIES.includes(exception.category)) {
    throw new AccountingValidationError(
      `Exceptions of category ${exception.category} can never be accepted for closure; they must be resolved.`,
      ids(context)
    );
  }
  if (['HIGH', 'CRITICAL'].includes(String(exception.severity).toUpperCase()) &&
      !(can && can('accountingPeriods.overrideMateriality'))) {
    throw new AccountingValidationError(
      'High-severity exceptions require the materiality-override permission to accept.',
      ids(context)
    );
  }
  const updated = await db.acctV2PeriodCloseException.update({
    where: { id: exception.id },
    data: { status: CloseExceptionStatus.ACCEPTED_FOR_CLOSE, acceptedBy: context.userId, acceptedAt: new Date() },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.period.exceptionAccepted',
      entityType: 'AcctV2PeriodCloseException',
      entityId: exception.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: { status: exception.status },
      newValues: { status: CloseExceptionStatus.ACCEPTED_FOR_CLOSE },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return updated;
}

/** Resolve an exception with evidence of the fix. */
export async function resolveCloseException(db, context, exceptionId, { resolutionTarget = null } = {}) {
  const exception = await db.acctV2PeriodCloseException.findFirst({
    where: { id: exceptionId, tenantId: context.businessId },
  });
  if (!exception) throw new AccountingValidationError('Exception not found for this business.', ids(context));
  return db.acctV2PeriodCloseException.update({
    where: { id: exception.id },
    data: {
      status: CloseExceptionStatus.RESOLVED,
      resolvedBy: context.userId,
      resolvedAt: new Date(),
      resolutionTarget,
    },
  });
}

/** Validate that a run's checklist and exceptions permit closure. */
async function assertRunClosable(db, context, run) {
  const tasks = await db.acctV2PeriodCloseTask.findMany({
    where: { closeRunId: run.id, tenantId: context.businessId },
  });
  const problems = [];
  for (const task of tasks) {
    if (task.blocking && !TASK_TERMINAL_OK.includes(task.status)) {
      problems.push(`Blocking task ${task.taskKey} is ${task.status}.`);
    }
    if (!task.blocking && task.required && task.status === CloseTaskStatus.NOT_STARTED) {
      problems.push(`Required task ${task.taskKey} has not started.`);
    }
  }
  const openBlocking = await db.acctV2PeriodCloseException.findMany({
    where: {
      tenantId: context.businessId,
      accountingPeriodId: run.accountingPeriodId,
      status: { in: [CloseExceptionStatus.OPEN, CloseExceptionStatus.UNDER_REVIEW] },
      severity: { in: ['HIGH', 'CRITICAL', 'high', 'critical'] },
    },
  });
  for (const e of openBlocking) {
    problems.push(`Open blocking exception ${e.category}: ${e.description}`);
  }
  if (run.trialBalanceStatus === TRIAL_BALANCE_STATUS.UNBALANCED || run.trialBalanceStatus === TRIAL_BALANCE_STATUS.BLOCKED) {
    problems.push(`Trial Balance status ${run.trialBalanceStatus} blocks ordinary closure.`);
  }
  if (problems.length > 0) {
    throw new AccountingValidationError(`Period cannot close: ${problems.join(' ')}`, ids(context));
  }
}

/** Submit a completed checklist for review. */
export async function submitCloseForReview(db, context, closeRunId) {
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  if (![CloseRunStatus.IN_PROGRESS, CloseRunStatus.BLOCKED].includes(run.status)) {
    throw new AccountingValidationError(`Cannot submit a run in status ${run.status}.`, ids(context));
  }
  await assertRunClosable(db, context, run);
  return db.acctV2PeriodCloseRun.update({
    where: { id: run.id },
    data: { status: CloseRunStatus.READY_FOR_REVIEW },
  });
}

/**
 * Approve a submitted close run. Separation of duties: the approver must not
 * be the run initiator.
 */
export async function approveCloseRun(db, context, closeRunId, { comment = null } = {}) {
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  if (run.status !== CloseRunStatus.READY_FOR_REVIEW) {
    throw new AccountingValidationError(`Cannot approve a run in status ${run.status}.`, ids(context));
  }
  if (run.initiatedBy === context.userId) {
    throw new AccountingValidationError(
      'Separation of duties: the user who initiated the close cannot approve it.',
      ids(context)
    );
  }
  await assertRunClosable(db, context, run);
  const approved = await db.acctV2PeriodCloseRun.update({
    where: { id: run.id },
    data: { status: CloseRunStatus.APPROVED, reviewedBy: context.userId, approvedBy: context.userId, metadata: { ...(run.metadata ?? {}), approvalComment: comment } },
  });
  await recordAccountingAudit(
    {
      action: 'acctv2.period.closeApproved',
      entityType: 'AcctV2PeriodCloseRun',
      entityId: run.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { status: CloseRunStatus.APPROVED },
      reason: comment,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return approved;
}

const SNAPSHOT_REPORT_TYPES = ['TRIAL_BALANCE', 'INCOME_STATEMENT', 'BALANCE_SHEET', 'CASH_FLOW', 'EQUITY_STATEMENT'];

/**
 * Close the period atomically (§34). Snapshots are generated BEFORE the
 * closure transaction (additive, safe on failure); the status flip, history,
 * run completion, supersession and outbox event commit together.
 */
export async function closePeriod(db, context, closeRunId, { reason = null } = {}) {
  const { run } = await getCloseRun(db, context, closeRunId, { includeTasks: false });
  if (run.status !== CloseRunStatus.APPROVED) {
    throw new AccountingValidationError(`Only an APPROVED close run can close the period (current: ${run.status}).`, ids(context));
  }
  const period = await getPeriodForBusiness(db, context, run.accountingPeriodId);
  if (period.status !== AccountingPeriodStatus.CLOSING) {
    throw new AccountingValidationError(`Period must be CLOSING to complete closure (current: ${period.status}).`, ids(context));
  }
  await assertRunClosable(db, context, run);

  const config = await getCalendarConfig(db, context);
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: period.financialYearId, tenantId: context.businessId },
  });

  // Final report snapshots — outside the closure transaction by design.
  const snapshotReferences = [];
  if (config.snapshotOnClose && db.acctV2ReportRun && db.acctV2ReportSnapshotV2) {
    for (const reportType of SNAPSHOT_REPORT_TYPES) {
      const { envelope } = await generateReport(db, context, reportType, {
        fromDate: isoDate(toDateOnly(period.startDate)),
        toDate: isoDate(toDateOnly(period.endDate)),
        asOfDate: isoDate(toDateOnly(period.endDate)),
        financialYearStartDate: fy ? isoDate(toDateOnly(fy.startDate)) : undefined,
      }, { useCache: false });
      const snapshot = await snapshotReport(db, context, envelope.runId, envelope, {
        reason: `Period close ${period.code} (run #${run.closeNumber})`,
      });
      snapshotReferences.push({ reportType, snapshotId: snapshot.id, runId: envelope.runId, checksum: snapshot.checksum ?? null });
    }
  }

  const isReclose = Boolean(run.metadata?.isReclose);
  const closed = await db.$transaction(async (tx) => {
    const freshPeriod = await tx.acctV2AccountingPeriod.findFirst({
      where: { id: period.id, tenantId: context.businessId },
    });
    if (freshPeriod.status !== AccountingPeriodStatus.CLOSING) {
      throw new AccountingValidationError('Period status changed during closure; aborting.', ids(context));
    }
    const updatedPeriod = await transitionPeriod(tx, context, freshPeriod, AccountingPeriodStatus.CLOSED,
      isReclose ? PeriodStatusAction.RECLOSE : PeriodStatusAction.CLOSE,
      {
        reason,
        approvedBy: run.approvedBy,
        extraData: isReclose
          ? { recloseDate: new Date(), reclosedBy: context.userId, closeReason: reason ?? run.reason ?? null }
          : { closeDate: new Date(), closedBy: context.userId, closeReason: reason ?? run.reason ?? null },
        metadata: { closeRunId: run.id, closeNumber: run.closeNumber, snapshots: snapshotReferences.length },
      });

    // Supersede prior completed runs (history preserved, never deleted).
    const priorCompleted = await tx.acctV2PeriodCloseRun.findMany({
      where: {
        tenantId: context.businessId,
        accountingPeriodId: period.id,
        status: CloseRunStatus.COMPLETED,
      },
    });
    for (const prior of priorCompleted) {
      await tx.acctV2PeriodCloseRun.update({
        where: { id: prior.id },
        data: { status: CloseRunStatus.SUPERSEDED },
      });
    }

    const completedRun = await tx.acctV2PeriodCloseRun.update({
      where: { id: run.id },
      data: {
        status: CloseRunStatus.COMPLETED,
        closedBy: context.userId,
        completedAt: new Date(),
        snapshotReferences,
      },
    });

    await enqueueOutboxMessage(tx, context, {
      aggregateType: 'AcctV2AccountingPeriod',
      aggregateId: period.id,
      eventType: isReclose ? 'PERIOD_RECLOSED' : 'PERIOD_CLOSED',
      payload: {
        periodId: period.id,
        periodCode: period.code,
        financialYearId: period.financialYearId,
        closeRunId: run.id,
        closeNumber: run.closeNumber,
        snapshots: snapshotReferences,
      },
    });

    return { period: updatedPeriod, run: completedRun };
  });

  await recordAccountingAudit(
    {
      action: isReclose ? 'acctv2.period.reclosed' : 'acctv2.period.closed',
      entityType: 'AcctV2AccountingPeriod',
      entityId: period.id,
      userId: context.userId,
      tenantId: context.businessId,
      previousValues: { status: AccountingPeriodStatus.CLOSING },
      newValues: { status: AccountingPeriodStatus.CLOSED, closeRunId: run.id, snapshots: snapshotReferences.length },
      reason,
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );
  return closed;
}
