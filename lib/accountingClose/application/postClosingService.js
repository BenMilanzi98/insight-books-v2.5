/**
 * Post-Closing Trial Balance, annual snapshots, FY closure, carry-forward.
 */

import { createHash } from 'crypto';
import { generateTrialBalance } from '../../accountingV2/reporting/trialBalanceService.js';
import { FinancialYearStatus, AccountingPeriodStatus } from '../../accountingV2/periods/periodEnums.js';
import { previewFinancialYear, createFinancialYear, openFinancialYear } from '../../accountingV2/periods/financialYearService.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';
import { validatePostClosingBalances } from '../domain/closingJournalGenerator.js';
import {
  PostClosingTrialBalanceUnbalancedError,
  CloseChecklistBlockedError,
  FinancialYearNotReadyError,
} from '../domain/errors.js';
import { ClosingBatchStatus, YearEndCloseRunStatus, CloseStatusAction } from '../domain/enums.js';
import { loadCloseRun } from './closeRunService.js';
import { requireApprovedClosingConfiguration } from './configService.js';

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function checksum(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function generatePostClosingTrialBalance(db, context, closeRunId) {
  const run = await loadCloseRun(db, context, closeRunId);
  const posted = run.batches.find((b) => b.status === ClosingBatchStatus.POSTED);
  if (!posted) throw new CloseChecklistBlockedError('Closing journals must be posted before PCTB.');

  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: run.financialYearId, tenantId: context.businessId },
    include: { periods: true },
  });

  const tb = await generateTrialBalance(db, context, {
    fromDate: iso(fy.startDate),
    toDate: iso(fy.endDate),
    asOfDate: iso(fy.endDate),
    includeZeroBalances: true,
    reportType: 'TRIAL_BALANCE',
  });

  const accounts = tb.lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode,
    category: l.category,
    subType: null,
    isHeader: l.isHeader,
    rawNetMinor: l.rawNetMinor,
  }));

  // Enrich subtype from CoA for CYE / drawings checks
  const meta = await db.account.findMany({
    where: { tenantId: context.businessId, id: { in: accounts.map((a) => a.accountId) } },
    select: { id: true, coaV2SubType: true, systemPurpose: true, coaV2Category: true },
  });
  const byId = new Map(meta.map((m) => [m.id, m]));
  for (const a of accounts) {
    const m = byId.get(a.accountId);
    if (m) {
      a.subType = m.coaV2SubType;
      a.coaV2SubType = m.coaV2SubType;
      a.systemPurpose = m.systemPurpose;
      a.category = a.category || m.coaV2Category;
    }
  }

  const cfg = await requireApprovedClosingConfiguration(db, context.businessId);
  const failures = validatePostClosingBalances(accounts, {
    drawingsClosed: cfg.drawingsCloseMethod !== 'LEAVE_OPEN',
  });

  const balanced = Boolean(tb.equations?.closingBalanced && tb.equations?.movementBalanced);
  const permanentLines = tb.lines.filter((l) => {
    const cat = String(l.category || '').toUpperCase();
    return ['ASSET', 'LIABILITY', 'EQUITY'].includes(cat) && Number(l.rawNetMinor || 0) !== 0;
  });

  const payload = {
    trialBalanceStatus: tb.trialBalanceStatus || tb.status,
    equations: tb.equations,
    permanentLineCount: permanentLines.length,
    temporaryNonZero: failures,
    lines: permanentLines.map((l) => ({
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      category: l.category,
      closingDebit: l.closingDebit,
      closingCredit: l.closingCredit,
      rawNetMinor: l.rawNetMinor,
    })),
    totals: tb.totals,
    closingJournalBatchId: posted.id,
    journalEntryId: posted.journalEntryId,
  };

  const status =
    !balanced || failures.length > 0 ? 'FAILED' : 'PASSED';

  const existing = await db.closeV2PostClosingTrialBalanceRun.findUnique({ where: { closeRunId } });
  const row = existing
    ? await db.closeV2PostClosingTrialBalanceRun.update({
        where: { closeRunId },
        data: {
          status,
          totalDebitMinor: BigInt(Math.round(Number(tb.totals?.closingDebit?.minor ?? 0))),
          totalCreditMinor: BigInt(Math.round(Number(tb.totals?.closingCredit?.minor ?? 0))),
          balanced: balanced && failures.length === 0,
          temporaryNonZeroCount: failures.length,
          payload,
          checksum: checksum(payload),
          generatedBy: context.userId,
          generatedAt: new Date(),
        },
      })
    : await db.closeV2PostClosingTrialBalanceRun.create({
        data: {
          tenantId: context.businessId,
          financialYearId: run.financialYearId,
          closeRunId,
          status,
          balanced: balanced && failures.length === 0,
          temporaryNonZeroCount: failures.length,
          payload,
          checksum: checksum(payload),
          generatedBy: context.userId,
        },
      });

  await db.closeV2YearEndCloseRun.update({
    where: { id: closeRunId },
    data: { postClosingTrialBalanceStatus: status },
  });

  if (status === 'FAILED') {
    throw new PostClosingTrialBalanceUnbalancedError(
      failures.length
        ? `PCTB failed: ${failures.map((f) => f.message).join('; ')}`
        : 'Post-Closing Trial Balance is unbalanced.'
    );
  }

  return row;
}

export async function generateAnnualSnapshots(db, context, closeRunId) {
  const run = await loadCloseRun(db, context, closeRunId);
  const pctb = await db.closeV2PostClosingTrialBalanceRun.findUnique({ where: { closeRunId } });
  if (!pctb || pctb.status !== 'PASSED') {
    throw new CloseChecklistBlockedError('PCTB must PASS before annual snapshots.');
  }

  const types = [
    { snapshotType: 'POST_CLOSING_TRIAL_BALANCE', payload: pctb.payload },
    {
      snapshotType: 'CLOSING_JOURNAL_BATCH',
      payload: run.batches.find((b) => b.status === ClosingBatchStatus.POSTED) || null,
    },
    {
      snapshotType: 'CLOSE_CHECKLIST',
      payload: { tasks: run.tasks, exceptions: run.exceptions },
    },
    {
      snapshotType: 'CLOSE_RUN_SUMMARY',
      payload: {
        closeVersion: run.closeVersion,
        closingMethod: run.closingMethod,
        finalProfitOrLossMinor: String(run.finalProfitOrLossMinor ?? 0),
        transferDestinationAccountId: run.transferDestinationAccountId,
        status: run.status,
      },
    },
  ];

  const created = [];
  for (const t of types) {
    const payload = t.payload || {};
    const row = await db.closeV2AnnualSnapshot.upsert({
      where: { closeRunId_snapshotType: { closeRunId, snapshotType: t.snapshotType } },
      create: {
        tenantId: context.businessId,
        financialYearId: run.financialYearId,
        closeRunId,
        closeVersion: run.closeVersion,
        snapshotType: t.snapshotType,
        payload,
        checksum: checksum(payload),
        generatedBy: context.userId,
      },
      update: {
        payload,
        checksum: checksum(payload),
        generatedBy: context.userId,
        generatedAt: new Date(),
      },
    });
    created.push(row);
  }

  await db.closeV2YearEndCloseRun.update({
    where: { id: closeRunId },
    data: {
      annualSnapshotReference: created.map((c) => ({ id: c.id, type: c.snapshotType, checksum: c.checksum })),
    },
  });

  return created;
}

/**
 * Continuous GL carry-forward: opening reporting balances = post-close permanent balances.
 * Does NOT create opening journals.
 */
export async function buildNextYearOpeningReportingBalances(db, context, financialYearId) {
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: financialYearId, tenantId: context.businessId },
  });
  if (!fy) throw new FinancialYearNotReadyError('Financial year not found.');

  const tb = await generateTrialBalance(db, context, {
    fromDate: iso(fy.startDate),
    toDate: iso(fy.endDate),
    asOfDate: iso(fy.endDate),
    includeZeroBalances: false,
    reportType: 'TRIAL_BALANCE',
  });

  const opening = tb.lines
    .filter((l) => {
      const cat = String(l.category || '').toUpperCase();
      return ['ASSET', 'LIABILITY', 'EQUITY'].includes(cat) && Number(l.rawNetMinor || 0) !== 0;
    })
    .map((l) => ({
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      category: l.category,
      openingDebit: l.closingDebit,
      openingCredit: l.closingCredit,
      openingNetMinor: l.rawNetMinor,
    }));

  return {
    sourceFinancialYearId: fy.id,
    sourceFinancialYearCode: fy.code,
    asOfDate: iso(fy.endDate),
    mode: 'CONTINUOUS_LEDGER_NO_OPENING_JOURNAL',
    accounts: opening,
    note: 'Opening reporting balances derive from posted JE lines. No opening journal is created.',
  };
}

export async function closeFinancialYear(db, context, closeRunId, options = {}) {
  const run = await loadCloseRun(db, context, closeRunId);
  const cfg = await requireApprovedClosingConfiguration(db, context.businessId);

  const posted = run.batches.find((b) => b.status === ClosingBatchStatus.POSTED);
  if (!posted) throw new CloseChecklistBlockedError('Closing journals not posted.');

  const pctb = await db.closeV2PostClosingTrialBalanceRun.findUnique({ where: { closeRunId } });
  if (!pctb || pctb.status !== 'PASSED') {
    throw new CloseChecklistBlockedError('Post-Closing Trial Balance must PASS.');
  }

  if (cfg.annualSnapshotRequired) {
    const snaps = await db.closeV2AnnualSnapshot.count({ where: { closeRunId } });
    if (snaps < 1) throw new CloseChecklistBlockedError('Annual snapshots required.');
  }

  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: run.financialYearId, tenantId: context.businessId },
    include: { periods: true },
  });
  if (!fy) throw new FinancialYearNotReadyError('Financial year not found.');
  if (fy.status === FinancialYearStatus.CLOSED) {
    throw new FinancialYearNotReadyError('Financial year already CLOSED.');
  }

  // Close final period if still open
  const finalPeriod =
    fy.periods.find((p) => p.isYearEndPeriod) || fy.periods.sort((a, b) => a.sequence - b.sequence).at(-1);

  const result = await db.$transaction(async (tx) => {
    if (
      finalPeriod &&
      [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.CLOSING, AccountingPeriodStatus.REOPENED].includes(
        finalPeriod.status
      )
    ) {
      await tx.acctV2AccountingPeriod.update({
        where: { id: finalPeriod.id },
        data: {
          status: AccountingPeriodStatus.CLOSED,
          closeDate: new Date(),
          lockDate: new Date(),
        },
      });
    }

    const closedFy = await tx.acctV2FinancialYear.update({
      where: { id: fy.id },
      data: {
        status: FinancialYearStatus.CLOSED,
        closedBy: context.userId,
        closedAt: new Date(),
        isCurrent: false,
        closeReason: options.reason || `Year-end close run ${run.closeVersion}`,
        metadata: {
          ...(fy.metadata || {}),
          closeV2: {
            closeRunId: run.id,
            closeVersion: run.closeVersion,
            closingBatchId: posted.id,
            journalEntryId: posted.journalEntryId,
            pctbId: pctb.id,
          },
        },
      },
    });

    const completed = await tx.closeV2YearEndCloseRun.update({
      where: { id: closeRunId },
      data: {
        status: YearEndCloseRunStatus.COMPLETED,
        completedBy: context.userId,
        completedAt: new Date(),
      },
    });

    await tx.closeV2CloseStatusHistory.create({
      data: {
        tenantId: context.businessId,
        financialYearId: fy.id,
        closeRunId,
        previousStatus: run.status,
        newStatus: YearEndCloseRunStatus.COMPLETED,
        action: CloseStatusAction.COMPLETE_CLOSE,
        executedBy: context.userId,
        requestId: context.requestId || null,
        correlationId: context.correlationId || null,
      },
    });

    return { closedFy, completed };
  });

  // Next year creation (outside FY close txn — calendar service has its own txn)
  let nextYear = null;
  if (cfg.automaticNextYearCreation) {
    const startYear = new Date(fy.endDate).getUTCFullYear();
    // Next FY starts the day after end — startYear for calendar is the calendar year of start
    const nextStart = new Date(fy.endDate);
    nextStart.setUTCDate(nextStart.getUTCDate() + 1);
    const nextStartYear = nextStart.getUTCFullYear();
    try {
      const existing = await db.acctV2FinancialYear.findFirst({
        where: {
          tenantId: context.businessId,
          startDate: { lte: nextStart },
          endDate: { gte: nextStart },
        },
      });
      if (!existing) {
        const created = await createFinancialYear(db, context, { startYear: nextStartYear });
        if (options.openNextYear !== false && created?.id) {
          try {
            nextYear = await openFinancialYear(db, context, created.id);
          } catch {
            nextYear = created;
          }
        } else {
          nextYear = created;
        }
      } else {
        nextYear = existing;
      }
    } catch (err) {
      nextYear = { error: String(err.message || err), startYearHint: nextStartYear || startYear };
    }
  }

  const openingBalances = await buildNextYearOpeningReportingBalances(db, context, fy.id);

  await recordAccountingAudit(
    {
      action: 'closev2.financialYear.closed',
      entityType: 'AcctV2FinancialYear',
      entityId: fy.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: {
        status: FinancialYearStatus.CLOSED,
        closeRunId,
        nextYearId: nextYear?.id || null,
      },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return {
    financialYear: result.closedFy,
    closeRun: result.completed,
    nextYear,
    openingReportingBalances: openingBalances,
    carryForwardMode: 'CONTINUOUS_LEDGER_NO_OPENING_JOURNAL',
  };
}

export { previewFinancialYear };
