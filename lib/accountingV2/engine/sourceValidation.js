/**
 * Posting engine — source transaction validation framework (Phase 4).
 *
 * Each event type registers a typed source validator. A validator receives the
 * posting command and a database client and must confirm the source exists,
 * belongs to the business, is postable, is not cancelled/deleted, is not already
 * posted for the same event, and that its values match the command.
 *
 * Only pilot validators are implemented in this phase (manual journal,
 * adjustment, opening balance, and the invoice shadow pilot). Full operational
 * adapters belong to Phase 9 — an unregistered event type is refused, never
 * silently accepted.
 */

import { AccountingEventType } from '../domain/enums.js';
import {
  SourceTransactionNotFoundError,
  SourceNotPostableError,
  SourceAlreadyPostedError,
  CrossTenantAccountingError,
  AccountingValidationError,
} from '../domain/errors.js';

/** @type {Map<string, (params: object) => Promise<object>>} */
const VALIDATORS = new Map();

/**
 * Register a source validator for an event type.
 * @param {string} eventType
 * @param {(params: {db: object, context: object, command: object}) => Promise<object>} validator
 *        resolves with the loaded source row; throws typed errors otherwise
 */
export function registerSourceValidator(eventType, validator) {
  VALIDATORS.set(eventType, validator);
}

/** @param {string} eventType */
export function hasSourceValidator(eventType) {
  return VALIDATORS.has(eventType);
}

/**
 * Run the registered validator for the command's event type.
 * @param {object} db transaction client or prisma
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {import('./postingCommand.js').PostingCommand} command
 * @returns {Promise<object>} loaded source row
 */
export async function validateSource(db, context, command) {
  const validator = VALIDATORS.get(command.sourceReference.eventType);
  if (!validator) {
    throw new AccountingValidationError(
      `No source validator is registered for event type "${command.sourceReference.eventType}". ` +
      'Operational module integration is deferred to Phase 9.',
      [{ path: 'eventType', message: 'unsupported in this phase' }],
      { requestId: context.requestId, correlationId: context.correlationId }
    );
  }
  return validator({ db, context, command });
}

/* ── Pilot validators ─────────────────────────────────────────────────────── */

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/**
 * Manual journal: the source IS the draft V2 journal row created by the manual
 * journal service. Postable when approved and not yet posted.
 */
async function manualJournalSourceValidator({ db, context, command }) {
  const row = await db.journalEntry.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: { lines: true },
  });
  if (!row) throw new SourceTransactionNotFoundError(ids(context));
  if (row.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { sourceId: row.id } });
  }
  if (row.status === 'Posted') {
    throw new SourceAlreadyPostedError({ ...ids(context), diagnostic: { sourceId: row.id } });
  }
  if (['Cancelled', 'Void'].includes(row.status)) {
    throw new SourceNotPostableError('This journal draft was cancelled.', ids(context));
  }
  if (row.status !== 'Approved') {
    throw new SourceNotPostableError(
      `Journal draft must be approved before posting (current status: ${row.status}).`,
      ids(context)
    );
  }
  if (!Array.isArray(row.lines) || row.lines.length < 2) {
    throw new SourceNotPostableError('Journal draft requires at least two lines.', ids(context));
  }
  return row;
}

/** Adjustment journal: same store as manual journals plus reason/category. */
async function adjustmentSourceValidator(params) {
  const row = await manualJournalSourceValidator(params);
  const { context } = params;
  if (!row.adjustmentCategory) {
    throw new SourceNotPostableError('Adjustment journals require an adjustment category.', ids(context));
  }
  if (!row.adjustmentReason || !String(row.adjustmentReason).trim()) {
    throw new SourceNotPostableError('Adjustment journals require a documented reason.', ids(context));
  }
  return row;
}

/** Opening balance: the source is the opening-balance batch. */
async function openingBalanceSourceValidator({ db, context, command }) {
  const batch = await db.acctV2OpeningBalanceBatch.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!batch) throw new SourceTransactionNotFoundError(ids(context));
  if (batch.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { batchId: batch.id } });
  }
  if (batch.status === 'POSTED') {
    throw new SourceAlreadyPostedError({ ...ids(context), diagnostic: { batchId: batch.id } });
  }
  if (batch.status === 'CANCELLED') {
    throw new SourceNotPostableError('This opening-balance batch was cancelled.', ids(context));
  }
  if (batch.status !== 'APPROVED') {
    throw new SourceNotPostableError(
      `Opening-balance batch must be approved before posting (current status: ${batch.status}).`,
      ids(context)
    );
  }
  if (!batch.evidenceReference) {
    throw new SourceNotPostableError('Opening balances require supporting evidence.', ids(context));
  }
  return batch;
}

/**
 * Customer invoice (SHADOW pilot only in Phase 4): validates the invoice exists,
 * belongs to the business, and is in a postable status. Used to generate shadow
 * proposals compared against legacy postings.
 */
async function invoiceSourceValidator({ db, context, command }) {
  const invoice = await db.invoice.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!invoice) throw new SourceTransactionNotFoundError(ids(context));
  if (invoice.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { invoiceId: invoice.id } });
  }
  const status = String(invoice.status ?? '').toLowerCase();
  if (['void', 'cancelled', 'deleted', 'draft'].includes(status)) {
    throw new SourceNotPostableError(`Invoice is not postable in status "${invoice.status}".`, ids(context));
  }
  return invoice;
}

/**
 * Reversal (Phase 5): the source is the ORIGINAL posted V2 journal being
 * reversed. It must be posted, unreversed, and owned by the business. Legacy
 * journals/transactions reverse through the legacy reversal path, never here.
 */
async function reversalSourceValidator({ db, context, command }) {
  const row = await db.journalEntry.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: { lines: true },
  });
  if (!row) throw new SourceTransactionNotFoundError(ids(context));
  if (row.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { sourceId: row.id } });
  }
  if (row.architectureVersion !== 'ACCOUNTING_V2') {
    throw new SourceNotPostableError(
      'Only V2 engine journals reverse through this workflow; legacy records use the legacy reversal service.',
      ids(context)
    );
  }
  if (row.status !== 'Posted') {
    throw new SourceNotPostableError(
      `Only posted journals can be reversed (current status: ${row.status}).`,
      ids(context)
    );
  }
  if (row.reversedByJournalId || row.reversalStatus === 'REVERSED') {
    throw new SourceAlreadyPostedError({
      ...ids(context),
      diagnostic: { sourceId: row.id, reversedByJournalId: row.reversedByJournalId },
    });
  }
  if (!Array.isArray(row.lines) || row.lines.length < 2) {
    throw new SourceNotPostableError('The journal to reverse has no reversible lines.', ids(context));
  }
  return row;
}

/**
 * Historical repair (Phase 6): the source is the idempotent repair ACTION row.
 * The action must belong to the business, sit in an executable state, and its
 * anomaly must be APPROVED_FOR_REPAIR with a stored repair proposal — the
 * engine posts exactly what was approved, nothing else. Approval facts come
 * from the anomaly (approvedBy/approvedAt) so separation of duties is
 * enforced against the executor.
 */
async function repairActionSourceValidator({ db, context, command }) {
  const action = await db.acctV2RepairAction.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!action) throw new SourceTransactionNotFoundError(ids(context));
  if (action.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { actionId: action.id } });
  }
  if (!['PENDING', 'EXECUTING'].includes(action.status)) {
    throw new SourceNotPostableError(
      `Repair action is not executable (status: ${action.status}).`,
      ids(context)
    );
  }
  const anomaly = await db.acctV2HistoricalAnomaly.findFirst({
    where: { id: action.anomalyId },
  });
  if (!anomaly || anomaly.tenantId !== context.businessId) {
    throw new SourceNotPostableError('Repair action references an invalid anomaly.', ids(context));
  }
  if (!['APPROVED_FOR_REPAIR', 'REPAIR_SCHEDULED', 'REPAIRING'].includes(anomaly.status)) {
    throw new SourceNotPostableError(
      `Anomaly is not approved for repair (status: ${anomaly.status}).`,
      ids(context)
    );
  }
  const proposal = anomaly.proposedRepairData;
  if (!proposal || !Array.isArray(proposal.lines) || proposal.lines.length < 2) {
    throw new SourceNotPostableError(
      'The approved repair proposal has no journal lines; only approved proposals post.',
      ids(context)
    );
  }
  return {
    ...action,
    anomaly,
    proposedLines: proposal.lines,
    repairReason: proposal.reason ?? action.reason,
    // Approval facts for the pipeline (from the anomaly's finance approval).
    approvedById: anomaly.approvedBy,
    approvedAt: anomaly.approvedAt,
    createdById: null, // separation of duties compares approver vs executor
  };
}

/* ── Phase 9 Stage 1–2 operational validators ─────────────────────────────── */

async function expenseSourceValidator({ db, context, command }) {
  const expense = await db.expense.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!expense) throw new SourceTransactionNotFoundError(ids(context));
  if (expense.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { expenseId: expense.id } });
  }
  if (expense.isDeleted || expense.deletedAt) {
    throw new SourceNotPostableError('Expense was deleted.', ids(context));
  }
  const status = String(expense.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'rejected', 'deleted'].includes(status)) {
    throw new SourceNotPostableError(
      `Expense is not postable in status "${expense.status}".`,
      ids(context)
    );
  }
  if (!expense.expenseAccountId) {
    throw new SourceNotPostableError('Expense account is required before posting.', ids(context));
  }
  return expense;
}

async function customerPaymentSourceValidator({ db, context, command }) {
  const payment = await db.payment.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: { invoice: { select: { id: true, clientId: true, tenantId: true } } },
  });
  if (!payment) throw new SourceTransactionNotFoundError(ids(context));
  if (payment.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { paymentId: payment.id } });
  }
  if (payment.isReversal) {
    throw new SourceNotPostableError('Reversal payment rows do not post as customer receipts.', ids(context));
  }
  const status = String(payment.status ?? 'Completed');
  if (status !== 'Completed' && status !== 'completed') {
    throw new SourceNotPostableError(`Payment is not completed (status: ${payment.status}).`, ids(context));
  }
  return payment;
}

async function invoiceRevenueRecognitionSourceValidator({ db, context, command }) {
  const payment = await db.payment.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: {
      invoice: {
        select: { id: true, clientId: true, invoiceNumber: true, tenantId: true },
      },
    },
  });
  if (!payment) throw new SourceTransactionNotFoundError(ids(context));
  if (payment.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { paymentId: payment.id } });
  }
  if (payment.isReversal) {
    throw new SourceNotPostableError(
      'Reversal payment rows do not post as invoice revenue recognition.',
      ids(context)
    );
  }
  const status = String(payment.status ?? 'Completed');
  if (status !== 'Completed' && status !== 'completed') {
    throw new SourceNotPostableError(`Payment is not completed (status: ${payment.status}).`, ids(context));
  }
  const linkedInvoiceId = payment.invoice?.id ?? payment.invoiceId ?? null;
  if (!linkedInvoiceId) {
    throw new SourceNotPostableError(
      `Invoice-Revenue payment ${payment.id} must be linked to an invoice.`,
      ids(context)
    );
  }
  const requestedInvoiceId = command.metadata?.invoiceId ?? null;
  if (requestedInvoiceId && requestedInvoiceId !== linkedInvoiceId) {
    throw new SourceNotPostableError(
      `Invoice-Revenue payment ${payment.id} is linked to invoice ${linkedInvoiceId}, not ${requestedInvoiceId}.`,
      ids(context)
    );
  }
  const amount = Number(command.metadata?.recognizedNet ?? command.totalAmount ?? 0);
  if (!(amount > 0)) {
    throw new SourceNotPostableError('Recognized revenue amount must be positive.', ids(context));
  }
  return {
    ...payment,
    recognizedNet: command.metadata?.recognizedNet ?? command.totalAmount,
    clientId: payment.invoice?.clientId,
    invoiceId: linkedInvoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
  };
}

async function supplierBillSourceValidator({ db, context, command }) {
  const bill = await db.supplierBill.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: { items: true, supplier: { select: { id: true, supplierName: true, tenantId: true } } },
  });
  if (!bill) throw new SourceTransactionNotFoundError(ids(context));
  if (bill.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { billId: bill.id } });
  }
  const status = String(bill.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'draft'].includes(status)) {
    throw new SourceNotPostableError(`Supplier bill is not postable in status "${bill.status}".`, ids(context));
  }
  return bill;
}

async function supplierPaymentSourceValidator({ db, context, command }) {
  const payment = await db.supplierPayment.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!payment) throw new SourceTransactionNotFoundError(ids(context));
  if (payment.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { paymentId: payment.id } });
  }
  if (payment.isReversal) {
    throw new SourceNotPostableError('Reversal supplier payments do not post as payments.', ids(context));
  }
  return payment;
}

async function bankingPaymentSourceValidator({ db, context, command }) {
  const payment = await db.payment.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!payment) throw new SourceTransactionNotFoundError(ids(context));
  if (payment.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { paymentId: payment.id } });
  }
  return payment;
}

registerSourceValidator(AccountingEventType.MANUAL_JOURNAL_POSTED, manualJournalSourceValidator);
registerSourceValidator(AccountingEventType.HISTORICAL_REPAIR_POSTED, repairActionSourceValidator);
registerSourceValidator(AccountingEventType.ADJUSTMENT_POSTED, adjustmentSourceValidator);
registerSourceValidator(AccountingEventType.OPENING_BALANCE_POSTED, openingBalanceSourceValidator);
registerSourceValidator(AccountingEventType.INVOICE_POSTED, invoiceSourceValidator);
registerSourceValidator(AccountingEventType.REVERSAL_POSTED, reversalSourceValidator);
registerSourceValidator(AccountingEventType.EXPENSE_POSTED, expenseSourceValidator);
registerSourceValidator(AccountingEventType.CUSTOMER_PAYMENT_POSTED, customerPaymentSourceValidator);
registerSourceValidator(
  AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
  invoiceRevenueRecognitionSourceValidator
);
registerSourceValidator(AccountingEventType.SUPPLIER_BILL_POSTED, supplierBillSourceValidator);
registerSourceValidator(AccountingEventType.SUPPLIER_PAYMENT_POSTED, supplierPaymentSourceValidator);
registerSourceValidator(AccountingEventType.BANK_CHARGE_POSTED, bankingPaymentSourceValidator);
registerSourceValidator(AccountingEventType.INTEREST_INCOME_POSTED, bankingPaymentSourceValidator);

/* ── Phase 9 Stage 3A operational validators ──────────────────────────────── */

async function posSaleSourceValidator({ db, context, command }) {
  const rawId = command.sourceReference.sourceId;
  const saleId = String(rawId).replace(/-revenue$/, '');
  const sale = await db.sale.findFirst({ where: { id: saleId } });
  if (!sale) throw new SourceTransactionNotFoundError(ids(context));
  if (sale.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { saleId } });
  }
  const status = String(sale.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'deleted', 'refunded'].includes(status)) {
    throw new SourceNotPostableError(`Sale is not postable in status "${sale.status}".`, ids(context));
  }
  return {
    ...sale,
    totalAmount: sale.totalAmount ?? sale.total ?? command.totalAmount,
    taxAmount: sale.taxAmount ?? command.taxAmount ?? 0,
  };
}

async function costOfSalesSourceValidator({ db, context, command }) {
  const sourceType = command.sourceReference.sourceType;
  const documentId = command.sourceReference.sourceId;
  const isInvoice = String(sourceType).startsWith('Invoice');
  if (isInvoice) {
    const invoice = await db.invoice.findFirst({ where: { id: documentId } });
    if (!invoice) throw new SourceTransactionNotFoundError(ids(context));
    if (invoice.tenantId !== context.businessId) {
      throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { invoiceId: documentId } });
    }
    return {
      ...invoice,
      costAmount: command.metadata?.costAmount ?? command.totalAmount,
      cogsAmount: command.metadata?.costAmount ?? command.totalAmount,
    };
  }
  const sale = await db.sale.findFirst({ where: { id: documentId } });
  if (!sale) throw new SourceTransactionNotFoundError(ids(context));
  if (sale.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { saleId: documentId } });
  }
  return {
    ...sale,
    costAmount: command.metadata?.costAmount ?? command.totalAmount,
    cogsAmount: command.metadata?.costAmount ?? command.totalAmount,
  };
}

async function goodsReceiptSourceValidator({ db, context, command }) {
  const receipt = await db.goodsReceipt.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!receipt) throw new SourceTransactionNotFoundError(ids(context));
  if (receipt.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({
      ...ids(context),
      diagnostic: { goodsReceiptId: receipt.id },
    });
  }
  const status = String(receipt.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'draft'].includes(status)) {
    throw new SourceNotPostableError(
      `Goods receipt is not postable in status "${receipt.status}".`,
      ids(context)
    );
  }
  return receipt;
}

async function stockAdjustmentSourceValidator({ db, context, command }) {
  // Write-offs are keyed by synthetic source ids (batch/qty); no single entity table.
  const amount = Number(command.totalAmount ?? command.metadata?.amount ?? 0);
  if (!(amount > 0)) {
    throw new SourceNotPostableError('Stock adjustment amount must be positive.', ids(context));
  }
  return {
    id: command.sourceReference.sourceId,
    amount,
    description: command.description,
    tenantId: context.businessId,
  };
}

registerSourceValidator(AccountingEventType.INVENTORY_SOLD, posSaleSourceValidator);
registerSourceValidator(AccountingEventType.COST_OF_SALES_RECOGNIZED, costOfSalesSourceValidator);
registerSourceValidator(AccountingEventType.INVENTORY_RECEIVED, goodsReceiptSourceValidator);
registerSourceValidator(AccountingEventType.STOCK_ADJUSTMENT_POSTED, stockAdjustmentSourceValidator);

async function creditNoteSourceValidator({ db, context, command }) {
  const note = await db.creditNote.findFirst({
    where: { id: command.sourceReference.sourceId },
  });
  if (!note) throw new SourceTransactionNotFoundError(ids(context));
  if (note.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { creditNoteId: note.id } });
  }
  const status = String(note.status ?? '').toLowerCase();
  if (['cancelled', 'void', 'draft', 'rejected'].includes(status)) {
    throw new SourceNotPostableError(
      `Credit note is not postable in status "${note.status}".`,
      ids(context)
    );
  }
  return {
    ...note,
    amount: note.amount ?? note.totalAmount ?? command.totalAmount,
    taxAmount: note.taxAmount ?? command.taxAmount ?? 0,
  };
}

async function customerRefundSourceValidator({ db, context, command }) {
  const refund = await db.invoiceRefund.findFirst({
    where: { id: command.sourceReference.sourceId },
    include: { invoice: { select: { id: true, clientId: true, invoiceNumber: true, tenantId: true } } },
  });
  if (!refund) throw new SourceTransactionNotFoundError(ids(context));
  if (refund.tenantId !== context.businessId) {
    throw new CrossTenantAccountingError({ ...ids(context), diagnostic: { refundId: refund.id } });
  }
  return {
    ...refund,
    refundAmount: refund.refundAmount ?? command.totalAmount,
    clientId: refund.invoice?.clientId,
    invoiceNumber: refund.invoice?.invoiceNumber,
  };
}

registerSourceValidator(AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED, creditNoteSourceValidator);
registerSourceValidator(AccountingEventType.CUSTOMER_REFUND_POSTED, customerRefundSourceValidator);

/** Stages 3C–6: accept command + metadata.lines as the postable source payload. */
async function metadataLinesSourceValidator({ context, command }) {
  // createPostingCommand normalizes totalAmount to a MoneyValue ({ decimal, minor, currency }).
  // Number(moneyObject) is NaN — always read `.decimal` (or a plain numeric/string).
  const amount = Number(command.totalAmount?.decimal ?? command.totalAmount ?? 0);
  if (!(amount > 0)) {
    throw new SourceNotPostableError('Posting amount must be positive.', ids(context));
  }
  const lines = command.metadata?.lines;
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new SourceNotPostableError('Balanced journal lines are required in metadata.', ids(context));
  }
  return {
    id: command.sourceReference.sourceId,
    tenantId: context.businessId,
    amount,
    lines,
    description: command.description,
  };
}

registerSourceValidator(AccountingEventType.BANK_TRANSFER_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.TAX_SETTLEMENT_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.EXPENSE_PAYMENT_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.PAYROLL_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.SALARY_ADVANCE_DISBURSED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.RENTAL_CUSTOMER_DEPOSIT, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.HIRE_SUPPLIER_DEPOSIT, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.HIRE_COST_ACCRUAL, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.HIRE_ACCRUAL_CLEARED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.ASSET_ACQUIRED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.DEPRECIATION_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.ASSET_DISPOSED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.LOAN_RECEIVED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.LOAN_REPAYMENT_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.CAPITAL_CONTRIBUTION_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.OWNER_DRAWING_POSTED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.DIVIDEND_DECLARED, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.DIVIDEND_PAID, metadataLinesSourceValidator);
registerSourceValidator(AccountingEventType.SUPPLIER_CREDIT_POSTED, metadataLinesSourceValidator);
