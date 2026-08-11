/**
 * Posting engine — legacy writer refusal (fresh-books V2-only).
 *
 * Legacy writers (`postGlEntry`, etc.) are always refused when V2 delegates exist.
 * Archived `Transaction` rows are not authoritative and must not block NEW_ENGINE posts.
 * Duplicate NEW_ENGINE effects are enforced by the event-registry unique key.
 */

import prisma from '../../prisma.js';
import { AccountingSourceModule, AccountingEventType } from '../domain/enums.js';
import { LegacyAndNewPostingConflictError } from '../domain/errors.js';

/** Legacy `sourceType` strings → V2 module/event scope (documentation / diagnostics). */
export const LEGACY_SOURCE_SCOPE = Object.freeze({
  JournalEntry: { moduleKey: AccountingSourceModule.MANUAL_JOURNAL, eventType: AccountingEventType.MANUAL_JOURNAL_POSTED },
  Manual: { moduleKey: AccountingSourceModule.MANUAL_JOURNAL, eventType: AccountingEventType.MANUAL_JOURNAL_POSTED },
  Invoice: { moduleKey: AccountingSourceModule.SALES, eventType: AccountingEventType.INVOICE_POSTED },
  'Invoice-Revenue': {
    moduleKey: AccountingSourceModule.SALES,
    eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
  },
  CreditNote: { moduleKey: AccountingSourceModule.SALES, eventType: AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED },
  InvoiceRefund: { moduleKey: AccountingSourceModule.RECEIVABLES, eventType: AccountingEventType.CUSTOMER_REFUND_POSTED },
  Sale: { moduleKey: AccountingSourceModule.POINT_OF_SALE, eventType: AccountingEventType.INVENTORY_SOLD },
  'Sale-COGS': { moduleKey: AccountingSourceModule.INVENTORY, eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED },
  'Invoice-COGS': { moduleKey: AccountingSourceModule.INVENTORY, eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED },
  Payment: { moduleKey: AccountingSourceModule.RECEIVABLES, eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED },
  ExpensePayment: { moduleKey: AccountingSourceModule.EXPENSES, eventType: AccountingEventType.EXPENSE_PAYMENT_POSTED },
  SalePayment: { moduleKey: AccountingSourceModule.POINT_OF_SALE, eventType: AccountingEventType.INVENTORY_SOLD },
  Transfer: { moduleKey: AccountingSourceModule.BANKING, eventType: AccountingEventType.BANK_TRANSFER_POSTED },
  PosCashDeposit: { moduleKey: AccountingSourceModule.BANKING, eventType: AccountingEventType.BANK_TRANSFER_POSTED },
  BankTransfer: { moduleKey: AccountingSourceModule.BANKING, eventType: AccountingEventType.BANK_TRANSFER_POSTED },
  PaymentAdjustment: { moduleKey: AccountingSourceModule.EQUITY, eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED },
  BankCharge: { moduleKey: AccountingSourceModule.BANKING, eventType: AccountingEventType.BANK_CHARGE_POSTED },
  InterestIncome: { moduleKey: AccountingSourceModule.BANKING, eventType: AccountingEventType.INTEREST_INCOME_POSTED },
  SupplierBill: { moduleKey: AccountingSourceModule.PAYABLES, eventType: AccountingEventType.SUPPLIER_BILL_POSTED },
  SupplierPayment: { moduleKey: AccountingSourceModule.PAYABLES, eventType: AccountingEventType.SUPPLIER_PAYMENT_POSTED },
  SupplierCredit: { moduleKey: AccountingSourceModule.PAYABLES, eventType: AccountingEventType.SUPPLIER_CREDIT_POSTED },
  GoodsReceipt: { moduleKey: AccountingSourceModule.PURCHASES, eventType: AccountingEventType.INVENTORY_RECEIVED },
  InventoryExpiryWriteOff: { moduleKey: AccountingSourceModule.INVENTORY, eventType: AccountingEventType.STOCK_ADJUSTMENT_POSTED },
  InventoryManualStockOut: { moduleKey: AccountingSourceModule.INVENTORY, eventType: AccountingEventType.STOCK_ADJUSTMENT_POSTED },
  Expense: { moduleKey: AccountingSourceModule.EXPENSES, eventType: AccountingEventType.EXPENSE_POSTED },
  Payroll: { moduleKey: AccountingSourceModule.PAYROLL, eventType: AccountingEventType.PAYROLL_POSTED },
  SalaryAdvance: {
    moduleKey: AccountingSourceModule.PAYROLL,
    eventType: AccountingEventType.SALARY_ADVANCE_DISBURSED,
  },
  RentalDeposit: {
    moduleKey: AccountingSourceModule.RECEIVABLES,
    eventType: AccountingEventType.RENTAL_CUSTOMER_DEPOSIT,
  },
  HireSupplierDeposit: {
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_SUPPLIER_DEPOSIT,
  },
  HireAccrual: {
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_COST_ACCRUAL,
  },
  HireAccrualClear: {
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_ACCRUAL_CLEARED,
  },
  Asset: { moduleKey: AccountingSourceModule.FIXED_ASSETS, eventType: AccountingEventType.ASSET_ACQUIRED },
  DepreciationSchedule: { moduleKey: AccountingSourceModule.FIXED_ASSETS, eventType: AccountingEventType.DEPRECIATION_POSTED },
  AssetDisposal: { moduleKey: AccountingSourceModule.FIXED_ASSETS, eventType: AccountingEventType.ASSET_DISPOSED },
  Liability: { moduleKey: AccountingSourceModule.LOANS, eventType: AccountingEventType.LOAN_RECEIVED },
  liability_opening: { moduleKey: AccountingSourceModule.LOANS, eventType: AccountingEventType.LOAN_RECEIVED },
  LiabilityPayment: { moduleKey: AccountingSourceModule.LOANS, eventType: AccountingEventType.LOAN_REPAYMENT_POSTED },
  capital_contribution: { moduleKey: AccountingSourceModule.EQUITY, eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED },
  OwnerDrawing: { moduleKey: AccountingSourceModule.EQUITY, eventType: AccountingEventType.OWNER_DRAWING_POSTED },
  TaxPayment: { moduleKey: AccountingSourceModule.TAX, eventType: AccountingEventType.TAX_SETTLEMENT_POSTED },
  OpeningBalance: { moduleKey: AccountingSourceModule.OPENING_BALANCES, eventType: AccountingEventType.OPENING_BALANCE_POSTED },
});

/**
 * Guard for legacy posting paths — always refuses when V2 schema is available.
 */
export async function assertLegacyPostingAllowed(params, db = prisma) {
  const { tenantId, sourceType, sourceId } = params;
  if (!tenantId) return;

  if (typeof db?.acctV2EventRegistry?.findFirst !== 'function') {
    throw new LegacyAndNewPostingConflictError(
      'Legacy posting is removed. Use the V2 posting engine (executePosting).'
    );
  }

  throw new LegacyAndNewPostingConflictError(
    'The V2 posting engine is authoritative; the legacy posting path is disabled.',
    {
      diagnostic: { sourceType: sourceType ?? null, sourceId: sourceId ?? null },
    }
  );
}

/**
 * Guard for the V2 engine. Fresh-books: Transaction archive is ignored.
 * Duplicate NEW_ENGINE effects are enforced by AcctV2EventRegistry uniqueness
 * (and reversal events use a distinct event type / source identity).
 */
export async function assertNewEnginePostingAllowed(_tx, _context, _ref) {
  return;
}
