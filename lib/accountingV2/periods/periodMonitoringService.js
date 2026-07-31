/**
 * Phase 8 — period integrity monitoring and close-readiness background checks
 * (§49). Business-scoped, idempotent and read-only: monitoring NEVER closes,
 * reopens or transitions periods — it only surfaces findings for the
 * approved workflows.
 */

import { runCalendarIntegrityAudit, getCalendarSummary } from './calendarIntegrityService.js';
import { toDateOnly } from './periodGeneration.js';
import { AccountingPeriodStatus, CloseRunStatus, ReopenRequestStatus } from './periodEnums.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Run all monitoring checks for one business.
 * @returns {Promise<{findings: Array, summary: object, integrity: object}>}
 */
export async function runPeriodMonitoring(db, context, { now = new Date(), openPeriodPolicyDays = 45 } = {}) {
  const findings = [];
  const today = toDateOnly(now);

  const [integrity, summary] = await Promise.all([
    runCalendarIntegrityAudit(db, context, { now }),
    getCalendarSummary(db, context, { now }),
  ]);
  for (const f of integrity.findings) {
    findings.push({ code: `INTEGRITY_${f.rule}`, severity: 'HIGH', message: f.message });
  }

  // Missing current period.
  if (summary.hasCalendar && !summary.currentPeriod) {
    findings.push({
      code: 'MISSING_CURRENT_PERIOD',
      severity: 'HIGH',
      message: 'No accounting period covers the current date. Generate the next financial year.',
    });
  }
  // Current financial year approaching its end without a successor.
  if (summary.currentFinancialYear) {
    const fyEnd = toDateOnly(summary.currentFinancialYear.endDate);
    const daysLeft = Math.round((fyEnd.getTime() - today.getTime()) / DAY);
    if (daysLeft <= 60) {
      const successor = await db.acctV2FinancialYear.findFirst({
        where: { tenantId: context.businessId, startDate: { gt: fyEnd } },
      });
      if (!successor) {
        findings.push({
          code: 'NEXT_FINANCIAL_YEAR_MISSING',
          severity: daysLeft <= 14 ? 'HIGH' : 'MEDIUM',
          message: `Current financial year ends in ${daysLeft} days and the next year has not been created.`,
        });
      }
    }
  }

  // Open periods older than policy (close overdue).
  const staleOpen = await db.acctV2AccountingPeriod.findMany({
    where: {
      tenantId: context.businessId,
      status: AccountingPeriodStatus.OPEN,
      endDate: { lt: new Date(today.getTime() - openPeriodPolicyDays * DAY) },
    },
    orderBy: { endDate: 'asc' },
  });
  for (const p of staleOpen) {
    findings.push({
      code: 'OPEN_PERIOD_OVERDUE',
      severity: 'MEDIUM',
      message: `Period ${p.code} ended more than ${openPeriodPolicyDays} days ago and is still open.`,
      periodId: p.id,
    });
  }

  // Close runs stuck in progress or blocked.
  const staleRuns = await db.acctV2PeriodCloseRun.findMany({
    where: {
      tenantId: context.businessId,
      status: { in: [CloseRunStatus.IN_PROGRESS, CloseRunStatus.BLOCKED, CloseRunStatus.READY_FOR_REVIEW] },
    },
  });
  for (const run of staleRuns) {
    const ageDays = Math.round((now.getTime() - new Date(run.startedAt).getTime()) / DAY);
    if (ageDays > 14) {
      findings.push({
        code: 'CLOSE_RUN_OVERDUE',
        severity: run.status === CloseRunStatus.BLOCKED ? 'HIGH' : 'MEDIUM',
        message: `Close run #${run.closeNumber} has been ${run.status} for ${ageDays} days.`,
        closeRunId: run.id,
      });
    }
  }

  // Reopened periods past their re-close deadline.
  const reopened = await db.acctV2PeriodReopenRequest.findMany({
    where: { tenantId: context.businessId, status: ReopenRequestStatus.EXECUTED },
  });
  for (const req of reopened) {
    const period = await db.acctV2AccountingPeriod.findFirst({
      where: { id: req.accountingPeriodId, tenantId: context.businessId },
    });
    if (period?.status === AccountingPeriodStatus.REOPENED && req.recloseDeadline && new Date(req.recloseDeadline) < now) {
      findings.push({
        code: 'RECLOSE_OVERDUE',
        severity: 'HIGH',
        message: `Period ${period.code} was reopened and its re-close deadline has passed.`,
        periodId: period.id,
      });
    }
  }

  // Rejected posting attempts into controlled periods (from the resolver audit).
  const rejectedAttempts = await db.auditLog.count({
    where: { tenantId: context.businessId, action: 'acctv2.period.postingRejected' },
  });
  if (rejectedAttempts > 0) {
    findings.push({
      code: 'CLOSED_PERIOD_POSTING_ATTEMPTS',
      severity: 'INFO',
      message: `${rejectedAttempts} posting attempts into controlled periods have been rejected and audited.`,
    });
  }

  return {
    businessId: context.businessId,
    generatedAt: new Date().toISOString(),
    integrity: { status: integrity.status, findingCount: integrity.findings.length },
    summary: {
      currentFinancialYear: summary.currentFinancialYear?.code ?? null,
      currentPeriod: summary.currentPeriod?.code ?? null,
      openPeriodCount: summary.openPeriodCount,
      closingPeriodCount: summary.closingPeriodCount,
    },
    findings,
  };
}
