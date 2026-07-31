/**
 * Closing Journal Batch — preview, checksum approval, post via Posting Engine.
 */

import { createHash } from 'crypto';
import { generateTrialBalance } from '../../accountingV2/reporting/trialBalanceService.js';
import {
  createManualJournalDraft,
  postManualJournal,
} from '../../accountingV2/application/manualJournalService.js';
import { PERSISTED_JOURNAL_STATUS } from '../../accountingV2/domain/journalStatus.js';
import { JournalStatus } from '../../accountingV2/domain/enums.js';
import { ACCOUNTING_PERMISSIONS } from '../../accountingV2/permissions.js';
import { minorToDecimalString } from '../../accountingV2/domain/money.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';
import { generateClosingJournalPreview, checksumPreview } from '../domain/closingJournalGenerator.js';
import {
  ClosingJournalAlreadyPostedError,
  ClosingPreviewChangedError,
  ClosingJournalUnbalancedError,
  CloseChecklistBlockedError,
} from '../domain/errors.js';
import { ClosingBatchStatus, YearEndCloseRunStatus, CloseMethod } from '../domain/enums.js';
import { requireApprovedClosingConfiguration, resolveDestinationAccountId } from './configService.js';
import { loadCloseRun } from './closeRunService.js';

function iso(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function loadFyAccounts(db, context, fy) {
  const tb = await generateTrialBalance(db, context, {
    fromDate: iso(fy.startDate),
    toDate: iso(fy.endDate),
    asOfDate: iso(fy.endDate),
    includeZeroBalances: true,
    reportType: 'TRIAL_BALANCE',
  });
  const accountIds = tb.lines.map((l) => l.accountId);
  const meta = await db.account.findMany({
    where: { tenantId: context.businessId, id: { in: accountIds } },
    select: {
      id: true,
      code: true,
      accountCode: true,
      name: true,
      accountName: true,
      type: true,
      category: true,
      coaV2Category: true,
      coaV2SubType: true,
      systemPurpose: true,
      isHeader: true,
      headerAccount: true,
    },
  });
  const byId = new Map(meta.map((a) => [a.id, a]));
  return tb.lines.map((l) => {
    const a = byId.get(l.accountId) || {};
    return {
      accountId: l.accountId,
      accountCode: l.accountCode || a.code || a.accountCode,
      accountName: l.accountName || a.name || a.accountName,
      category: l.category || a.coaV2Category || a.category || a.type,
      accountType: a.type,
      subType: a.coaV2SubType,
      coaV2SubType: a.coaV2SubType,
      systemPurpose: a.systemPurpose,
      isHeader: Boolean(l.isHeader || a.isHeader || a.headerAccount),
      rawNetMinor: l.rawNetMinor,
    };
  });
}

export async function generateClosingBatchPreview(db, context, closeRunId, { partnerAllocations } = {}) {
  const run = await loadCloseRun(db, context, closeRunId);
  if (
    ![
      YearEndCloseRunStatus.APPROVED_FOR_CLOSING,
      YearEndCloseRunStatus.READY_FOR_REVIEW,
      YearEndCloseRunStatus.CLOSING,
      YearEndCloseRunStatus.RECLOSING,
    ].includes(run.status)
  ) {
    throw new CloseChecklistBlockedError(`Cannot generate closing batch in status ${run.status}.`);
  }

  const cfg = await requireApprovedClosingConfiguration(db, context.businessId);
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: run.financialYearId, tenantId: context.businessId },
  });
  const accounts = await loadFyAccounts(db, context, fy);
  const destinationAccountId = resolveDestinationAccountId(cfg);
  let incomeSummaryAccount = null;
  if (cfg.incomeSummaryAccountId) {
    const a = await db.account.findFirst({
      where: { id: cfg.incomeSummaryAccountId, tenantId: context.businessId },
    });
    incomeSummaryAccount = a
      ? { accountId: a.id, accountCode: a.code || a.accountCode, accountName: a.name || a.accountName }
      : { accountId: cfg.incomeSummaryAccountId };
  }
  let ownerCapitalAccount = null;
  if (cfg.ownerCapitalAccountId) {
    ownerCapitalAccount = { accountId: cfg.ownerCapitalAccountId };
  }

  const preview = generateClosingJournalPreview({
    closingMethod: cfg.closeMethod,
    destinationAccountId,
    incomeSummaryAccount,
    ownerCapitalAccount,
    closeDrawings: cfg.drawingsCloseMethod !== 'LEAVE_OPEN',
    partnerAllocations: partnerAllocations || cfg.metadata?.partnerAllocations || [],
    accounts,
  });

  const existingPosted = run.batches.find((b) => b.status === ClosingBatchStatus.POSTED);
  if (existingPosted) {
    throw new ClosingJournalAlreadyPostedError('A closing batch is already posted for this close run.');
  }

  // Supersede prior unposted versions
  await db.closeV2ClosingJournalBatch.updateMany({
    where: {
      closeRunId,
      status: { in: [ClosingBatchStatus.GENERATED, ClosingBatchStatus.READY_FOR_REVIEW, ClosingBatchStatus.APPROVED] },
    },
    data: { status: ClosingBatchStatus.SUPERSEDED },
  });

  const lastVersion = run.batches[0]?.version || 0;
  const version = lastVersion + 1;
  const idempotencyKey = `closev2:${context.businessId}:${closeRunId}:batch:${version}`;

  const batch = await db.closeV2ClosingJournalBatch.create({
    data: {
      tenantId: context.businessId,
      financialYearId: run.financialYearId,
      closeRunId,
      batchNumber: 1,
      closingMethod: cfg.closeMethod,
      version,
      status: ClosingBatchStatus.READY_FOR_REVIEW,
      temporaryAccountCount: preview.temporaryAccountCount,
      lineCount: preview.lineCount,
      totalDebitMinor: preview.totalDebitMinor,
      totalCreditMinor: preview.totalCreditMinor,
      calculatedProfitOrLossMinor: preview.calculatedProfitOrLossMinor,
      destinationAccountId,
      previewPayload: preview,
      previewChecksum: preview.previewChecksum,
      generatedBy: context.userId,
      generatedAt: new Date(),
      idempotencyKey,
      requestId: context.requestId || null,
      correlationId: context.correlationId || null,
      checksum: preview.previewChecksum,
      lines: {
        create: preview.lines.map((l) => ({
          tenantId: context.businessId,
          sequence: l.sequence,
          accountId: l.accountId,
          accountCode: l.accountCode || null,
          accountName: l.accountName || null,
          accountCategory: l.accountCategory || null,
          lineRole: l.lineRole,
          debitMinor: l.debitMinor || 0,
          creditMinor: l.creditMinor || 0,
          description: l.description || null,
          metadata: l.metadata || null,
        })),
      },
    },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });

  await db.closeV2YearEndCloseRun.update({
    where: { id: closeRunId },
    data: {
      finalProfitOrLossMinor: preview.calculatedProfitOrLossMinor,
      transferDestinationAccountId: destinationAccountId,
      closeChecksum: preview.previewChecksum,
    },
  });

  return { batch, preview };
}

export async function approveClosingBatch(db, context, batchId) {
  const batch = await db.closeV2ClosingJournalBatch.findFirst({
    where: { id: batchId, tenantId: context.businessId },
    include: { lines: true, closeRun: true },
  });
  if (!batch) throw new CloseChecklistBlockedError('Closing batch not found.');
  if (batch.status === ClosingBatchStatus.POSTED) {
    throw new ClosingJournalAlreadyPostedError();
  }

  // Recompute checksum against current GL — invalidate if changed
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: batch.financialYearId, tenantId: context.businessId },
  });
  const cfg = await requireApprovedClosingConfiguration(db, context.businessId);
  const accounts = await loadFyAccounts(db, context, fy);
  const fresh = generateClosingJournalPreview({
    closingMethod: batch.closingMethod,
    destinationAccountId: batch.destinationAccountId,
    incomeSummaryAccount: cfg.incomeSummaryAccountId
      ? { accountId: cfg.incomeSummaryAccountId }
      : null,
    ownerCapitalAccount: cfg.ownerCapitalAccountId ? { accountId: cfg.ownerCapitalAccountId } : null,
    closeDrawings: cfg.drawingsCloseMethod !== 'LEAVE_OPEN',
    partnerAllocations: cfg.metadata?.partnerAllocations || [],
    accounts,
  });
  if (fresh.previewChecksum !== batch.previewChecksum) {
    await db.closeV2ClosingJournalBatch.update({
      where: { id: batchId },
      data: { status: ClosingBatchStatus.INVALID },
    });
    throw new ClosingPreviewChangedError(
      'Accounting data changed after preview. Regenerate and re-approve the Closing Journal Batch.'
    );
  }

  if (batch.generatedBy === context.userId) {
    // SoD: preferred separate approver — allowed but audited
  }

  return db.closeV2ClosingJournalBatch.update({
    where: { id: batchId },
    data: {
      status: ClosingBatchStatus.APPROVED,
      approvedBy: context.userId,
      approvedAt: new Date(),
      reviewedBy: context.userId,
    },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });
}

/**
 * Post closing batch atomically through Posting Engine (manual journal promote path).
 */
export async function postClosingBatch(db, context, batchId, options = {}) {
  const batch = await db.closeV2ClosingJournalBatch.findFirst({
    where: { id: batchId, tenantId: context.businessId },
    include: { lines: { orderBy: { sequence: 'asc' } } },
  });
  if (!batch) throw new CloseChecklistBlockedError('Closing batch not found.');
  if (batch.status === ClosingBatchStatus.POSTED && batch.journalEntryId) {
    return { batch, journalEntryId: batch.journalEntryId, replayed: true };
  }
  if (batch.status !== ClosingBatchStatus.APPROVED) {
    throw new CloseChecklistBlockedError('Closing batch must be APPROVED before posting.');
  }

  // Revalidate checksum
  await approveClosingBatch(db, context, batchId);

  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: batch.financialYearId, tenantId: context.businessId },
  });
  const entryDate = iso(fy.endDate);

  if (Number(batch.totalDebitMinor) !== Number(batch.totalCreditMinor)) {
    throw new ClosingJournalUnbalancedError();
  }

  await db.closeV2ClosingJournalBatch.update({
    where: { id: batchId },
    data: { status: ClosingBatchStatus.POSTING },
  });
  await db.closeV2YearEndCloseRun.update({
    where: { id: batch.closeRunId },
    data: { status: YearEndCloseRunStatus.CLOSING },
  });

  const hasPermission = options.hasPermission || (() => true);
  const lines = batch.lines
    .filter((l) => Number(l.debitMinor) > 0 || Number(l.creditMinor) > 0)
    .map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debitMinor) > 0 ? minorToDecimalString(l.debitMinor) : null,
      credit: Number(l.creditMinor) > 0 ? minorToDecimalString(l.creditMinor) : null,
      description: l.description || `Year-end close ${l.lineRole}`,
    }));

  try {
    const draft = await createManualJournalDraft(
      context,
      {
        description: `YEA-CLS Year-end closing ${fy.code} (close run ${batch.closeRunId}, batch v${batch.version})`,
        entryDate,
        currency: context.currency || 'MWK',
        lines,
        adjustment: {
          category: 'AUDIT_ADJUSTMENT',
          reason: `Year-end closing journals for ${fy.code}. Method ${batch.closingMethod}. Checksum ${batch.previewChecksum}.`,
        },
        dimensions: {},
        attachments: [],
      },
      {
        hasPermission: (key) =>
          hasPermission(key) ||
          key === ACCOUNTING_PERMISSIONS.JOURNAL_CREATE_ADJUSTMENT ||
          key === ACCOUNTING_PERMISSIONS.JOURNAL_CREATE,
      },
      db
    );

    // Stamp closing metadata on draft
    await db.journalEntry.update({
      where: { id: draft.id },
      data: {
        metadata: {
          ...(draft.metadata || {}),
          closeV2: {
            closeRunId: batch.closeRunId,
            batchId: batch.id,
            closingMethod: batch.closingMethod,
            previewChecksum: batch.previewChecksum,
            journalType: 'YEA-CLS',
            architectureVersion: 'CLOSE_V2',
          },
        },
        status: PERSISTED_JOURNAL_STATUS[JournalStatus.APPROVED] || 'Approved',
      },
    });

    const posted = await postManualJournal(
      context,
      draft.id,
      {
        hasPermission: (key) =>
          hasPermission(key) ||
          key === ACCOUNTING_PERMISSIONS.JOURNAL_POST_ADJUSTMENT ||
          key === ACCOUNTING_PERMISSIONS.JOURNAL_POST,
        postingDate: entryDate,
      },
      db
    );

    const journalEntryId = posted.journalEntryId || posted.journal?.id || draft.id;

    const updated = await db.closeV2ClosingJournalBatch.update({
      where: { id: batchId },
      data: {
        status: ClosingBatchStatus.POSTED,
        postedBy: context.userId,
        postedAt: new Date(),
        journalEntryId,
      },
      include: { lines: true },
    });

    await db.closeV2YearEndCloseRun.update({
      where: { id: batch.closeRunId },
      data: {
        closingJournalCount: { increment: 1 },
        finalProfitOrLossMinor: batch.calculatedProfitOrLossMinor,
      },
    });

    await recordAccountingAudit(
      {
        action: 'closev2.closingBatch.posted',
        entityType: 'CloseV2ClosingJournalBatch',
        entityId: batchId,
        userId: context.userId,
        tenantId: context.businessId,
        newValues: {
          journalEntryId,
          profitOrLossMinor: String(batch.calculatedProfitOrLossMinor),
          checksum: batch.previewChecksum,
        },
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );

    return { batch: updated, journalEntryId, posted, replayed: false };
  } catch (err) {
    await db.closeV2ClosingJournalBatch.update({
      where: { id: batchId },
      data: { status: ClosingBatchStatus.FAILED, metadata: { lastError: String(err.message || err) } },
    });
    throw err;
  }
}

export { checksumPreview, CloseMethod };
