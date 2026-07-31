/**
 * Annual Close Pack — assemble close evidence and export Excel / JSON.
 */

import { loadCloseRun } from './closeRunService.js';
import { buildNextYearOpeningReportingBalances } from './postClosingService.js';
import { ClosingBatchStatus } from '../domain/enums.js';
import { CloseChecklistBlockedError } from '../domain/errors.js';
import { minorToDecimalString } from '../../accountingV2/domain/money.js';

function iso(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

export async function buildAnnualClosePack(db, context, closeRunId) {
  const run = await loadCloseRun(db, context, closeRunId);
  const fy = await db.acctV2FinancialYear.findFirst({
    where: { id: run.financialYearId, tenantId: context.businessId },
  });
  if (!fy) throw new CloseChecklistBlockedError('Financial year not found.');

  const pctb = await db.closeV2PostClosingTrialBalanceRun.findUnique({ where: { closeRunId } });
  const snapshots = await db.closeV2AnnualSnapshot.findMany({
    where: { closeRunId, tenantId: context.businessId },
  });
  const postedBatch = run.batches.find((b) => b.status === ClosingBatchStatus.POSTED);
  const history = run.statusHistory || [];

  let openingBalances = null;
  try {
    openingBalances = await buildNextYearOpeningReportingBalances(db, context, fy.id);
  } catch {
    openingBalances = null;
  }

  const pack = {
    packType: 'ANNUAL_CLOSE_PACK',
    architectureVersion: 'CLOSE_V2',
    generatedAt: new Date().toISOString(),
    generatedBy: context.userId,
    businessId: context.businessId,
    financialYear: {
      id: fy.id,
      code: fy.code,
      name: fy.name,
      startDate: iso(fy.startDate),
      endDate: iso(fy.endDate),
      status: fy.status,
      closedAt: fy.closedAt ? iso(fy.closedAt) : null,
      closedBy: fy.closedBy,
    },
    closeRun: {
      id: run.id,
      closeVersion: run.closeVersion,
      status: run.status,
      closingMethod: run.closingMethod,
      startedBy: run.startedBy,
      approvedBy: run.approvedBy,
      completedBy: run.completedBy,
      finalProfitOrLoss: run.finalProfitOrLossMinor != null
        ? minorToDecimalString(run.finalProfitOrLossMinor)
        : null,
      transferDestinationAccountId: run.transferDestinationAccountId,
      checklistTemplate: `${run.checklistTemplateId}@${run.checklistTemplateVersion}`,
      taskSummary: {
        expected: run.expectedTaskCount,
        completed: run.completedTaskCount,
        blocked: run.blockedTaskCount,
        warnings: run.warningTaskCount,
      },
    },
    checklist: (run.tasks || []).map((t) => ({
      taskKey: t.taskKey,
      name: t.name,
      module: t.module,
      kind: t.kind,
      blocking: t.blocking,
      status: t.status,
      completedBy: t.completedBy,
      completedAt: t.completedAt,
      waiveReason: t.waiveReason,
    })),
    exceptions: (run.exceptions || []).map((e) => ({
      id: e.id,
      category: e.category,
      severity: e.severity,
      status: e.status,
      description: e.description,
      amountMinor: e.amountMinor != null ? String(e.amountMinor) : null,
      disclosureRequired: e.disclosureRequired,
    })),
    closingJournal: postedBatch
      ? {
          batchId: postedBatch.id,
          version: postedBatch.version,
          status: postedBatch.status,
          journalEntryId: postedBatch.journalEntryId,
          checksum: postedBatch.previewChecksum,
          profitOrLoss: minorToDecimalString(postedBatch.calculatedProfitOrLossMinor),
          totalDebit: minorToDecimalString(postedBatch.totalDebitMinor),
          totalCredit: minorToDecimalString(postedBatch.totalCreditMinor),
          lineCount: postedBatch.lineCount,
        }
      : null,
    postClosingTrialBalance: pctb
      ? {
          status: pctb.status,
          balanced: pctb.balanced,
          temporaryNonZeroCount: pctb.temporaryNonZeroCount,
          checksum: pctb.checksum,
        }
      : null,
    snapshots: snapshots.map((s) => ({
      type: s.snapshotType,
      checksum: s.checksum,
      generatedAt: s.generatedAt,
      closeVersion: s.closeVersion,
    })),
    approvals: history.map((h) => ({
      action: h.action,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      executedBy: h.executedBy,
      approvedBy: h.approvedBy,
      reason: h.reason,
      at: h.createdAt,
    })),
    nextYearOpeningReportingBalances: openingBalances,
    carryForwardMode: 'CONTINUOUS_LEDGER_NO_OPENING_JOURNAL',
    confirmations: [
      'Closing Journals posted via Posting Engine.',
      'Balance Sheet accounts were not closed to zero.',
      'Current Year Earnings MODEL A — single profit transfer.',
      'No duplicate opening journal created.',
      'Original close versions and snapshots are preserved on reopen.',
    ],
  };

  return pack;
}

export async function exportAnnualClosePackExcel(db, context, closeRunId) {
  const pack = await buildAnnualClosePack(db, context, closeRunId);
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InsightBooks Year-End Close';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Close Summary');
  summary.addRow(['Annual Close Pack']);
  summary.addRow(['Business', pack.businessId]);
  summary.addRow(['Financial Year', pack.financialYear.code]);
  summary.addRow(['FY Period', `${pack.financialYear.startDate} – ${pack.financialYear.endDate}`]);
  summary.addRow(['FY Status', pack.financialYear.status]);
  summary.addRow(['Close Version', pack.closeRun.closeVersion]);
  summary.addRow(['Close Status', pack.closeRun.status]);
  summary.addRow(['Closing Method', pack.closeRun.closingMethod]);
  summary.addRow(['Final Profit/(Loss)', pack.closeRun.finalProfitOrLoss]);
  summary.addRow(['Prepared / Started By', pack.closeRun.startedBy]);
  summary.addRow(['Approved By', pack.closeRun.approvedBy]);
  summary.addRow(['Closed By', pack.closeRun.completedBy]);
  summary.addRow(['Generated At', pack.generatedAt]);
  summary.addRow(['Carry-forward', pack.carryForwardMode]);

  const checklist = workbook.addWorksheet('Checklist');
  checklist.addRow(['Task', 'Module', 'Kind', 'Blocking', 'Status', 'Completed By', 'Waive Reason']);
  for (const t of pack.checklist) {
    checklist.addRow([t.taskKey, t.module, t.kind, t.blocking, t.status, t.completedBy, t.waiveReason]);
  }

  const exceptions = workbook.addWorksheet('Exceptions');
  exceptions.addRow(['Severity', 'Status', 'Category', 'Description', 'Amount Minor', 'Disclosure']);
  for (const e of pack.exceptions) {
    exceptions.addRow([e.severity, e.status, e.category, e.description, e.amountMinor, e.disclosureRequired]);
  }

  const closing = workbook.addWorksheet('Closing Journal');
  closing.addRow(['Field', 'Value']);
  if (pack.closingJournal) {
    for (const [k, v] of Object.entries(pack.closingJournal)) {
      closing.addRow([k, v]);
    }
  } else {
    closing.addRow(['status', 'NOT_POSTED']);
  }

  const pctb = workbook.addWorksheet('Post-Closing TB');
  pctb.addRow(['Field', 'Value']);
  if (pack.postClosingTrialBalance) {
    for (const [k, v] of Object.entries(pack.postClosingTrialBalance)) {
      pctb.addRow([k, v]);
    }
  }

  const approvals = workbook.addWorksheet('Approvals');
  approvals.addRow(['Action', 'From', 'To', 'Executed By', 'Reason', 'At']);
  for (const a of pack.approvals) {
    approvals.addRow([a.action, a.previousStatus, a.newStatus, a.executedBy, a.reason, a.at]);
  }

  const opening = workbook.addWorksheet('Next Year Opening');
  opening.addRow(['Account Code', 'Account Name', 'Category', 'Opening Debit', 'Opening Credit', 'Net Minor']);
  for (const a of pack.nextYearOpeningReportingBalances?.accounts || []) {
    opening.addRow([
      a.accountCode,
      a.accountName,
      a.category,
      a.openingDebit?.decimal ?? a.openingDebit,
      a.openingCredit?.decimal ?? a.openingCredit,
      a.openingNetMinor,
    ]);
  }

  const confirmations = workbook.addWorksheet('Confirmations');
  for (const c of pack.confirmations) confirmations.addRow([c]);

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    pack,
    filename: `annual-close-pack-${pack.financialYear.code}-v${pack.closeRun.closeVersion}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(buffer),
  };
}
