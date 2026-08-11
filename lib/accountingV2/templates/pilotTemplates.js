/**
 * Posting engine — implemented pilot templates (Phase 4).
 *
 *   MANUAL_JOURNAL   v1 ACTIVE — the sanctioned production pilot.
 *   ADJUSTMENT       v1 ACTIVE — authorized corrections (reason + approval).
 *   OPENING_BALANCE  v1 ACTIVE — controlled onboarding batches.
 *   CUSTOMER_INVOICE v1 ACTIVE — shadow-comparison pilot (activation for
 *                    production posting is governed solely by posting mode).
 *
 * Templates never persist anything. They validate their inputs and return a
 * frozen Journal Draft; the engine validates and persists.
 */

import { createJournalDraft, createJournalLineDraft } from '../domain/journalDraft.js';
import { money, convertToBase } from '../domain/money.js';
import { AccountingEventType } from '../domain/enums.js';
import { PostingTemplateValidationError } from '../domain/errors.js';
import { registerTemplate, TemplateStatus } from './templateRegistry.js';

/** Convert a persisted journal-entry line (Prisma Decimal) to a draft line. */
function draftLineFromPersisted(line, currency, exchangeRate, baseCurrency, index) {
  const debitStr = line.debitAmount != null ? String(line.debitAmount) : '0';
  const creditStr = line.creditAmount != null ? String(line.creditAmount) : '0';
  const debit = debitStr !== '0' && Number(debitStr) !== 0 ? debitStr : null;
  const credit = creditStr !== '0' && Number(creditStr) !== 0 ? creditStr : null;
  const base = (value) =>
    value != null ? convertToBase(money(value, currency), exchangeRate, baseCurrency) : null;
  return createJournalLineDraft({
    accountId: line.accountId,
    debit,
    credit,
    baseDebit: base(debit),
    baseCredit: base(credit),
    currency,
    sequence: line.lineNumber ?? index + 1,
    description: line.description ?? null,
    dimensions: line.dimensions ?? {},
    taxReference: line.taxCode ?? null,
  });
}

/* ── Manual journal ───────────────────────────────────────────────────────── */

async function buildManualJournalDraft({ context, command, source }) {
  const currency = command.currency;
  const lines = source.lines.map((l, i) =>
    draftLineFromPersisted(l, currency, command.exchangeRate, command.baseCurrency, i)
  );
  return createJournalDraft({
    description: command.description ?? source.description ?? 'Manual journal',
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: command.sourceReference,
    currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: {
      ...command.metadata,
      templateId: 'MANUAL_JOURNAL',
      attachments: command.attachmentReferences,
    },
  });
}

registerTemplate({
  templateId: 'MANUAL_JOURNAL',
  templateVersion: 1,
  eventType: AccountingEventType.MANUAL_JOURNAL_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['JournalEntry'],
  requiredPurposes: [],
  requiredSourceFields: ['lines', 'description'],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'departmentId', 'projectId', 'costCentreId'],
  prohibitedDimensions: [],
  approvalRule: 'Approval required per manual-journal policy; separation of duties enforced.',
  reversalBehaviour: 'Reversible through a REVERSAL_POSTED event that mirrors every line.',
  description: 'User-authored balanced journal with explicit account lines.',
  buildDraft: buildManualJournalDraft,
});

/* ── Adjustment journal ───────────────────────────────────────────────────── */

async function buildAdjustmentDraft(params) {
  const draft = await buildManualJournalDraft(params);
  const { source } = params;
  if (!source.adjustmentCategory || !source.adjustmentReason) {
    throw new PostingTemplateValidationError([
      { path: 'adjustment', message: 'category and reason are required' },
    ]);
  }
  return createJournalDraft({
    ...draft,
    lines: [...draft.lines],
    metadata: {
      ...draft.metadata,
      templateId: 'ADJUSTMENT_JOURNAL',
      adjustmentCategory: source.adjustmentCategory,
      adjustmentReason: source.adjustmentReason,
      relatedJournalId: source.relatedJournalId ?? null,
    },
  });
}

registerTemplate({
  templateId: 'ADJUSTMENT_JOURNAL',
  templateVersion: 1,
  eventType: AccountingEventType.ADJUSTMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['JournalEntry'],
  requiredPurposes: [],
  requiredSourceFields: ['lines', 'adjustmentCategory', 'adjustmentReason'],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'departmentId', 'projectId', 'costCentreId'],
  prohibitedDimensions: [],
  approvalRule: 'Always requires approval by a user other than the creator.',
  reversalBehaviour: 'Reversible through a REVERSAL_POSTED event.',
  description: 'Authorized correction journal with mandatory reason, category and audit linkage.',
  buildDraft: buildAdjustmentDraft,
});

/* ── Opening balance ──────────────────────────────────────────────────────── */

async function buildOpeningBalanceDraft({ command, source }) {
  const currency = command.currency;
  const rawLines = source.metadata?.lines;
  if (!Array.isArray(rawLines) || rawLines.length < 2) {
    throw new PostingTemplateValidationError([
      { path: 'lines', message: 'opening-balance batch requires at least two balance lines' },
    ]);
  }
  const lines = rawLines.map((l, i) =>
    createJournalLineDraft({
      accountId: l.accountId,
      debit: l.debit != null && Number(l.debit) !== 0 ? String(l.debit) : null,
      credit: l.credit != null && Number(l.credit) !== 0 ? String(l.credit) : null,
      currency,
      sequence: i + 1,
      description: l.description ?? 'Opening balance',
      dimensions: l.dimensions ?? {},
    })
  );
  const effective = new Date(source.effectiveDate).toISOString().slice(0, 10);
  return createJournalDraft({
    description: source.description ?? `Opening balances as at ${effective}`,
    transactionDate: effective,
    postingDate: effective,
    sourceReference: command.sourceReference,
    currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: {
      ...command.metadata,
      templateId: 'OPENING_BALANCE',
      openingBalanceBatchId: source.id,
      evidenceReference: source.evidenceReference,
    },
  });
}

registerTemplate({
  templateId: 'OPENING_BALANCE',
  templateVersion: 1,
  eventType: AccountingEventType.OPENING_BALANCE_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['OpeningBalanceBatch'],
  requiredPurposes: ['OPENING_BALANCE_EQUITY'],
  requiredSourceFields: ['effectiveDate', 'evidenceReference', 'metadata.lines'],
  requiredDimensions: [],
  optionalDimensions: ['customerId', 'supplierId', 'bankAccountId', 'assetId', 'loanId'],
  prohibitedDimensions: [],
  approvalRule: 'Always requires approval; one approved batch per business and effective date/version.',
  reversalBehaviour: 'Correction only through reversal or an authorized opening-balance correction adjustment.',
  description: 'Controlled opening-balance journal: assets, liabilities and equity, balanced before posting.',
  buildDraft: buildOpeningBalanceDraft,
});

/* ── Reversal journal (Phase 5) ───────────────────────────────────────────── */

async function buildReversalDraft({ command, source }) {
  // `source` is the ORIGINAL posted V2 journal (validated by the reversal
  // source validator). Every line is mirrored with debit and credit swapped —
  // amounts, accounts and dimensions are never re-derived or re-converted.
  const currency = source.currency ?? command.currency;
  const exchangeRate = source.exchangeRate != null ? String(source.exchangeRate) : command.exchangeRate;
  const reason = command.metadata?.reversalReason;
  if (!reason || !String(reason).trim()) {
    throw new PostingTemplateValidationError([
      { path: 'reversalReason', message: 'a documented reason is required to reverse a posted journal' },
    ]);
  }
  const lines = source.lines.map((l, i) => {
    const debitStr = l.debitAmount != null ? String(l.debitAmount) : '0';
    const creditStr = l.creditAmount != null ? String(l.creditAmount) : '0';
    // Swap sides; preserve the original stored base amounts symmetrically.
    const debit = Number(creditStr) !== 0 ? creditStr : null;
    const credit = Number(debitStr) !== 0 ? debitStr : null;
    const baseFor = (primary, storedBase) =>
      primary == null ? null : storedBase != null ? money(String(storedBase), command.baseCurrency ?? currency) : null;
    return createJournalLineDraft({
      accountId: l.accountId,
      debit,
      credit,
      baseDebit: baseFor(debit, l.baseCredit) ?? (debit != null ? convertToBase(money(debit, currency), exchangeRate, command.baseCurrency ?? currency) : null),
      baseCredit: baseFor(credit, l.baseDebit) ?? (credit != null ? convertToBase(money(credit, currency), exchangeRate, command.baseCurrency ?? currency) : null),
      currency,
      sequence: l.lineNumber ?? i + 1,
      description: `Reversal — ${l.description ?? 'journal line'}`,
      dimensions: l.dimensions ?? {},
      taxReference: l.taxCode ?? null,
    });
  });
  const originalLabel = source.journalNumber ?? source.referenceNumber ?? source.id;
  return createJournalDraft({
    description: command.description ?? `Reversal of ${originalLabel}: ${reason}`,
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: command.sourceReference,
    currency,
    exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: {
      ...command.metadata,
      templateId: 'REVERSAL_JOURNAL',
      originalJournalId: source.id,
      originalJournalNumber: source.journalNumber ?? null,
      reversalReason: reason,
    },
  });
}

registerTemplate({
  templateId: 'REVERSAL_JOURNAL',
  templateVersion: 1,
  eventType: AccountingEventType.REVERSAL_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['JournalEntry'],
  requiredPurposes: [],
  requiredSourceFields: ['lines', 'status'],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'departmentId', 'projectId', 'costCentreId'],
  prohibitedDimensions: [],
  approvalRule: 'Requires journal.reverse permission; the original journal must be posted and unreversed.',
  reversalBehaviour: 'Terminal — a reversal journal is corrected by a new adjustment, never re-reversed in place.',
  description: 'Mirrors every line of a posted V2 journal with debit/credit swapped; links both directions.',
  buildDraft: buildReversalDraft,
});

/* ── Historical repair journal (Phase 6) ──────────────────────────────────── */

async function buildHistoricalRepairDraft({ command, source }) {
  // `source` is the validated repair ACTION merged with its approved anomaly
  // proposal. The lines posted are EXACTLY the approved proposal lines —
  // the template refuses to derive or invent anything else.
  const currency = command.currency;
  const reason = source.repairReason;
  if (!reason || !String(reason).trim()) {
    throw new PostingTemplateValidationError([
      { path: 'reason', message: 'a documented repair reason is required' },
    ]);
  }
  const rawLines = source.proposedLines;
  if (!Array.isArray(rawLines) || rawLines.length < 2) {
    throw new PostingTemplateValidationError([
      { path: 'lines', message: 'an approved repair journal requires at least two lines' },
    ]);
  }
  const lines = rawLines.map((l, i) => {
    const debit = l.debit != null && Number(l.debit) !== 0 ? String(l.debit) : null;
    const credit = l.credit != null && Number(l.credit) !== 0 ? String(l.credit) : null;
    const base = (v) =>
      v != null ? convertToBase(money(v, currency), command.exchangeRate, command.baseCurrency ?? currency) : null;
    return createJournalLineDraft({
      accountId: l.accountId,
      debit,
      credit,
      baseDebit: base(debit),
      baseCredit: base(credit),
      currency,
      sequence: i + 1,
      description: l.description ?? `Historical repair — ${reason}`,
      dimensions: l.dimensions ?? {},
      taxReference: l.taxCode ?? null,
    });
  });
  return createJournalDraft({
    description:
      command.description ?? `Historical repair (${source.repairType}) — ${reason}`,
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: command.sourceReference,
    currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: {
      ...command.metadata,
      templateId: 'HISTORICAL_REPAIR',
      repairActionId: source.id,
      anomalyId: source.anomalyId,
      repairBatchId: source.batchId,
      repairType: source.repairType,
      repairVersion: source.repairVersion,
      originalJournalId: source.anomaly?.journalEntryId ?? null,
      originalTransactionId: source.anomaly?.transactionId ?? null,
      originalSourceType: source.anomaly?.sourceType ?? null,
      originalSourceId: source.anomaly?.sourceId ?? null,
      repairReason: reason,
      approvalReference: command.approvalReference ?? null,
    },
  });
}

registerTemplate({
  templateId: 'HISTORICAL_REPAIR',
  templateVersion: 1,
  eventType: AccountingEventType.HISTORICAL_REPAIR_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['AcctV2RepairAction'],
  requiredPurposes: [],
  requiredSourceFields: ['anomalyId', 'repairType', 'reason'],
  requiredDimensions: [],
  optionalDimensions: ['branchId', 'departmentId', 'projectId', 'costCentreId', 'customerId', 'supplierId'],
  prohibitedDimensions: [],
  approvalRule:
    'Always requires finance approval recorded on the anomaly; approver must differ from executor.',
  reversalBehaviour:
    'A repair journal is never deleted; an incorrect repair is corrected by a further approved repair journal.',
  description:
    'Evidence-based historical correction: duplicate reversal, reclassification, adjustment or missing-journal creation. Posts exactly the approved proposal lines.',
  buildDraft: buildHistoricalRepairDraft,
});

/* ── Customer invoice (shadow pilot) ──────────────────────────────────────── */

async function buildCustomerInvoiceDraft({ context, command, source, resolvePurpose }) {
  const currency = command.currency;
  const ar = await resolvePurpose('ACCOUNTS_RECEIVABLE');
  const deferred = await resolvePurpose('DEFERRED_REVENUE');

  const total = money(String(source.total), currency);
  const tax = money(String(source.taxAmount ?? '0'), currency);
  const net = money(
    ((total.minor - tax.minor) / 100).toFixed(2),
    currency
  );
  if (total.minor <= 0) {
    throw new PostingTemplateValidationError([
      { path: 'total', message: 'invoice total must be positive to post' },
    ]);
  }

  const customerId = command.dimensions.customerId ?? source.clientId;
  const lines = [
    createJournalLineDraft({
      accountId: ar.id,
      debit: total.decimal,
      currency,
      sequence: 1,
      description: `Invoice ${source.invoiceNumber}`,
      dimensions: { customerId },
    }),
    createJournalLineDraft({
      accountId: deferred.id,
      credit: net.decimal,
      currency,
      sequence: 2,
      description: `Deferred revenue — invoice ${source.invoiceNumber}`,
      dimensions: { customerId },
    }),
  ];
  if (tax.minor > 0) {
    const vatOutput = await resolvePurpose('VAT_OUTPUT');
    lines.push(
      createJournalLineDraft({
        accountId: vatOutput.id,
        credit: tax.decimal,
        currency,
        sequence: 3,
        description: `VAT output — invoice ${source.invoiceNumber}`,
        dimensions: { customerId },
      })
    );
  }

  return createJournalDraft({
    description: command.description ?? `Customer invoice ${source.invoiceNumber}`,
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: command.sourceReference,
    currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: { ...command.metadata, templateId: 'CUSTOMER_INVOICE' },
  });
}

registerTemplate({
  templateId: 'CUSTOMER_INVOICE',
  templateVersion: 1,
  eventType: AccountingEventType.INVOICE_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Invoice'],
  requiredPurposes: ['ACCOUNTS_RECEIVABLE', 'DEFERRED_REVENUE', 'VAT_OUTPUT'],
  requiredSourceFields: ['total', 'taxAmount', 'invoiceNumber', 'clientId'],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['branchId', 'projectId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'Follows invoice approval status; no separate posting approval.',
  reversalBehaviour: 'Credit note or invoice reversal event; never in-place edits.',
  description: 'Dr Accounts Receivable / Cr Deferred Revenue / Cr VAT Output. Shadow pilot in Phase 4.',
  buildDraft: buildCustomerInvoiceDraft,
});
