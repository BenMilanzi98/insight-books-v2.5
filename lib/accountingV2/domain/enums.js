/**
 * Accounting V2 — single source of domain enumerations.
 *
 * These are the only definitions of these constants in the codebase.
 * Do not re-declare accounting enums in other modules; import from here.
 */

export const AccountingSourceModule = Object.freeze({
  SALES: 'SALES',
  POINT_OF_SALE: 'POINT_OF_SALE',
  RECEIVABLES: 'RECEIVABLES',
  PURCHASES: 'PURCHASES',
  PAYABLES: 'PAYABLES',
  EXPENSES: 'EXPENSES',
  PAYROLL: 'PAYROLL',
  INVENTORY: 'INVENTORY',
  BANKING: 'BANKING',
  MOBILE_MONEY: 'MOBILE_MONEY',
  FIXED_ASSETS: 'FIXED_ASSETS',
  LOANS: 'LOANS',
  TAX: 'TAX',
  EQUITY: 'EQUITY',
  OPENING_BALANCES: 'OPENING_BALANCES',
  MANUAL_JOURNAL: 'MANUAL_JOURNAL',
  PERIOD_CLOSE: 'PERIOD_CLOSE',
  YEAR_END_CLOSE: 'YEAR_END_CLOSE',
  BANK_RECONCILIATION: 'BANK_RECONCILIATION',
  MIGRATION: 'MIGRATION',
});

export const AccountingEventType = Object.freeze({
  INVOICE_POSTED: 'INVOICE_POSTED',
  INVOICE_REVENUE_RECOGNIZED: 'INVOICE_REVENUE_RECOGNIZED',
  CUSTOMER_PAYMENT_POSTED: 'CUSTOMER_PAYMENT_POSTED',
  CUSTOMER_CREDIT_NOTE_POSTED: 'CUSTOMER_CREDIT_NOTE_POSTED',
  CUSTOMER_REFUND_POSTED: 'CUSTOMER_REFUND_POSTED',
  SUPPLIER_BILL_POSTED: 'SUPPLIER_BILL_POSTED',
  SUPPLIER_PAYMENT_POSTED: 'SUPPLIER_PAYMENT_POSTED',
  SUPPLIER_CREDIT_POSTED: 'SUPPLIER_CREDIT_POSTED',
  EXPENSE_POSTED: 'EXPENSE_POSTED',
  /** Settle AP / employee / credit-card payable for a previously recognized expense. */
  EXPENSE_PAYMENT_POSTED: 'EXPENSE_PAYMENT_POSTED',
  PAYROLL_POSTED: 'PAYROLL_POSTED',
  PAYROLL_PAYMENT_POSTED: 'PAYROLL_PAYMENT_POSTED',
  /** Salary advance disbursement (Dr Advances Receivable / Cr Cash|Bank) — not payroll expense. */
  SALARY_ADVANCE_DISBURSED: 'SALARY_ADVANCE_DISBURSED',
  /** Customer refundable rental deposit (Dr Cash / Cr Deposit Liability). */
  RENTAL_CUSTOMER_DEPOSIT: 'RENTAL_CUSTOMER_DEPOSIT',
  /** Supplier refundable hire deposit (Dr Deposit Asset / Cr Cash). */
  HIRE_SUPPLIER_DEPOSIT: 'HIRE_SUPPLIER_DEPOSIT',
  /** Accrued inbound hire cost before supplier bill. */
  HIRE_COST_ACCRUAL: 'HIRE_COST_ACCRUAL',
  /** Reverse hire accrual when supplier bill recognises expense/AP. */
  HIRE_ACCRUAL_CLEARED: 'HIRE_ACCRUAL_CLEARED',
  INVENTORY_RECEIVED: 'INVENTORY_RECEIVED',
  INVENTORY_SOLD: 'INVENTORY_SOLD',
  COST_OF_SALES_RECOGNIZED: 'COST_OF_SALES_RECOGNIZED',
  STOCK_ADJUSTMENT_POSTED: 'STOCK_ADJUSTMENT_POSTED',
  BANK_CHARGE_POSTED: 'BANK_CHARGE_POSTED',
  INTEREST_INCOME_POSTED: 'INTEREST_INCOME_POSTED',
  /** Inter-account / POS cash deposit transfer (Dr dest, Cr source). */
  BANK_TRANSFER_POSTED: 'BANK_TRANSFER_POSTED',
  /** Tax liability settlement (Dr tax payable, Cr bank). */
  TAX_SETTLEMENT_POSTED: 'TAX_SETTLEMENT_POSTED',
  LOAN_RECEIVED: 'LOAN_RECEIVED',
  LOAN_REPAYMENT_POSTED: 'LOAN_REPAYMENT_POSTED',
  ASSET_ACQUIRED: 'ASSET_ACQUIRED',
  DEPRECIATION_POSTED: 'DEPRECIATION_POSTED',
  ASSET_DISPOSED: 'ASSET_DISPOSED',
  CAPITAL_CONTRIBUTION_POSTED: 'CAPITAL_CONTRIBUTION_POSTED',
  OWNER_DRAWING_POSTED: 'OWNER_DRAWING_POSTED',
  DIVIDEND_DECLARED: 'DIVIDEND_DECLARED',
  DIVIDEND_PAID: 'DIVIDEND_PAID',
  OPENING_BALANCE_POSTED: 'OPENING_BALANCE_POSTED',
  OPENING_STOCK_POSTED: 'OPENING_STOCK_POSTED',
  MANUAL_JOURNAL_POSTED: 'MANUAL_JOURNAL_POSTED',
  ADJUSTMENT_POSTED: 'ADJUSTMENT_POSTED',
  REVERSAL_POSTED: 'REVERSAL_POSTED',
  /** Phase 6: evidence-based historical repair journal (reversal of legacy
   * duplicates, reclassification, adjustment, missing-journal creation). */
  HISTORICAL_REPAIR_POSTED: 'HISTORICAL_REPAIR_POSTED',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  YEAR_CLOSED: 'YEAR_CLOSED',
});

export const JournalStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  POSTING: 'POSTING',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
  PARTIALLY_REVERSED: 'PARTIALLY_REVERSED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const ApprovalStatus = Object.freeze({
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

export const PostingMode = Object.freeze({
  LEGACY: 'LEGACY',
  SHADOW: 'SHADOW',
  DUAL_COMPARE: 'DUAL_COMPARE',
  NEW_ENGINE: 'NEW_ENGINE',
  DISABLED: 'DISABLED',
});

export const AccountNormalBalance = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
});

export const AccountCategory = Object.freeze({
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  COST_OF_SALES: 'COST_OF_SALES',
  EXPENSE: 'EXPENSE',
  OTHER_INCOME: 'OTHER_INCOME',
  OTHER_EXPENSE: 'OTHER_EXPENSE',
});

export const AccountBehaviour = Object.freeze({
  HEADER: 'HEADER',
  POSTING: 'POSTING',
  CONTROL: 'CONTROL',
  SYSTEM: 'SYSTEM',
  CONTRA: 'CONTRA',
});

export const ReversalStatus = Object.freeze({
  NOT_REVERSED: 'NOT_REVERSED',
  REVERSAL_PENDING: 'REVERSAL_PENDING',
  REVERSED: 'REVERSED',
  PARTIALLY_REVERSED: 'PARTIALLY_REVERSED',
});

export const PeriodStatus = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

export const AuditSeverity = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFORMATIONAL: 'INFORMATIONAL',
});

export const EventRegistryStatus = Object.freeze({
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  POSTED: 'POSTED',
  SHADOWED: 'SHADOWED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  SUPERSEDED: 'SUPERSEDED',
});

export const ArchitectureVersion = Object.freeze({
  LEGACY_V1: 'LEGACY_V1',
  TRANSITION_V2: 'TRANSITION_V2',
  ACCOUNTING_V2: 'ACCOUNTING_V2',
});

export const ShadowComparisonStatus = Object.freeze({
  EXACT_MATCH: 'EXACT_MATCH',
  ACCOUNT_DIFFERENCE: 'ACCOUNT_DIFFERENCE',
  AMOUNT_DIFFERENCE: 'AMOUNT_DIFFERENCE',
  MISSING_LEGACY_POSTING: 'MISSING_LEGACY_POSTING',
  MISSING_NEW_PROPOSAL: 'MISSING_NEW_PROPOSAL',
  DUPLICATE_LEGACY_POSTING: 'DUPLICATE_LEGACY_POSTING',
  PERIOD_DIFFERENCE: 'PERIOD_DIFFERENCE',
  DIMENSION_DIFFERENCE: 'DIMENSION_DIFFERENCE',
  UNBALANCED_LEGACY: 'UNBALANCED_LEGACY',
  INVALID_NEW_PROPOSAL: 'INVALID_NEW_PROPOSAL',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
});

export const OutboxStatus = Object.freeze({
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

export const AttemptStatus = Object.freeze({
  STARTED: 'STARTED',
  SUCCEEDED: 'SUCCEEDED',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_FATAL: 'FAILED_FATAL',
  CONFLICT: 'CONFLICT',
});

/** @param {Record<string,string>} enumObj @param {unknown} value */
export function isEnumValue(enumObj, value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(enumObj, value);
}

/**
 * Assert value is a member of an enum, throwing a typed configuration error message.
 * @param {Record<string,string>} enumObj
 * @param {unknown} value
 * @param {string} label
 */
export function assertEnumValue(enumObj, value, label) {
  if (!isEnumValue(enumObj, value)) {
    const allowed = Object.keys(enumObj).join(', ');
    throw new RangeError(`Invalid ${label}: ${String(value)}. Allowed: ${allowed}`);
  }
  return value;
}
