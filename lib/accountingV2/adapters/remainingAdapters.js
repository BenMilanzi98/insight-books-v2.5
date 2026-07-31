/**
 * Phase 9 Stages 3C–6 — cutover adapters for remaining modules.
 * Callers pass `buildLines` (or prebuilt `lines`) for NEW_ENGINE metadata.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

function engineInput({
  sourceModule,
  sourceType,
  sourceId,
  sourceNumber,
  eventType,
  date,
  currency,
  totalAmount,
  description,
  dimensions = {},
  metadata = {},
  lines = null,
}) {
  return {
    sourceReference: {
      sourceModule,
      sourceType,
      sourceId,
      sourceNumber: sourceNumber || sourceId,
      eventType,
    },
    transactionDate: toIsoDate(date),
    requestedPostingDate: toIsoDate(date),
    currency,
    totalAmount: amountString(totalAmount),
    taxAmount: '0.00',
    description,
    dimensions,
    metadata: lines ? { ...metadata, lines } : metadata,
    payload: null,
  };
}

export async function postBankTransferAccounting({
  db,
  tenantId,
  userId,
  sourceType = 'Transfer',
  sourceId,
  amount,
  date,
  description,
  fromAccountId,
  toAccountId,
  lines = null,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.BANKING,
    eventType: AccountingEventType.BANK_TRANSFER_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.BANKING,
        sourceType,
        sourceId,
        eventType: AccountingEventType.BANK_TRANSFER_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Bank transfer',
        metadata: { fromAccountId, toAccountId },
        lines,
      }),
  });
}

export async function postPayrollAccounting({
  db,
  tenantId,
  userId,
  payrollId,
  amount,
  date,
  description,
  lines,
  sourceType = 'Payroll',
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYROLL,
    eventType: AccountingEventType.PAYROLL_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYROLL,
        sourceType,
        sourceId: payrollId,
        eventType: AccountingEventType.PAYROLL_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Payroll',
        lines,
      }),
  });
}

/**
 * Salary advance disbursement — Dr Advances Receivable / Cr Cash|Bank.
 * Must not use PAYROLL_POSTED (that event is payroll expense recognition).
 */
export async function postSalaryAdvanceAccounting({
  db,
  tenantId,
  userId,
  advanceId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYROLL,
    eventType: AccountingEventType.SALARY_ADVANCE_DISBURSED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYROLL,
        sourceType: 'SalaryAdvance',
        sourceId: advanceId,
        eventType: AccountingEventType.SALARY_ADVANCE_DISBURSED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Salary Advance',
        lines,
      }),
  });
}

/** Customer rental deposit — liability, never rental revenue. */
export async function postRentalCustomerDepositAccounting({
  db,
  tenantId,
  userId,
  depositId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.RECEIVABLES,
    eventType: AccountingEventType.RENTAL_CUSTOMER_DEPOSIT,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.RECEIVABLES,
        sourceType: 'RentalDeposit',
        sourceId: depositId,
        eventType: AccountingEventType.RENTAL_CUSTOMER_DEPOSIT,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Customer rental deposit',
        lines,
      }),
  });
}

/** Supplier hire deposit — asset, never hire expense. */
export async function postHireSupplierDepositAccounting({
  db,
  tenantId,
  userId,
  depositId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_SUPPLIER_DEPOSIT,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYABLES,
        sourceType: 'HireSupplierDeposit',
        sourceId: depositId,
        eventType: AccountingEventType.HIRE_SUPPLIER_DEPOSIT,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Supplier hire deposit',
        lines,
      }),
  });
}

/** Accrue inbound hire cost before supplier bill. */
export async function postHireCostAccrualAccounting({
  db,
  tenantId,
  userId,
  accrualId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_COST_ACCRUAL,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYABLES,
        sourceType: 'HireAccrual',
        sourceId: accrualId,
        eventType: AccountingEventType.HIRE_COST_ACCRUAL,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Hire cost accrual',
        lines,
      }),
  });
}

/** Clear hire accrual (Dr Accrued / Cr Expense) when supplier bill posts expense. */
export async function postHireAccrualClearedAccounting({
  db,
  tenantId,
  userId,
  accrualId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.HIRE_ACCRUAL_CLEARED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYABLES,
        sourceType: 'HireAccrualClear',
        sourceId: accrualId,
        eventType: AccountingEventType.HIRE_ACCRUAL_CLEARED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Hire accrual cleared',
        lines,
      }),
  });
}

export async function postAssetAcquiredAccounting({
  db,
  tenantId,
  userId,
  assetId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.FIXED_ASSETS,
    eventType: AccountingEventType.ASSET_ACQUIRED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.FIXED_ASSETS,
        sourceType: 'Asset',
        sourceId: assetId,
        eventType: AccountingEventType.ASSET_ACQUIRED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Asset acquired',
        dimensions: { assetId },
        lines,
      }),
  });
}

export async function postDepreciationAccounting({
  db,
  tenantId,
  userId,
  sourceId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.FIXED_ASSETS,
    eventType: AccountingEventType.DEPRECIATION_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.FIXED_ASSETS,
        sourceType: 'DepreciationSchedule',
        sourceId,
        eventType: AccountingEventType.DEPRECIATION_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Depreciation',
        lines,
      }),
  });
}

export async function postLoanReceivedAccounting({
  db,
  tenantId,
  userId,
  liabilityId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.LOANS,
    eventType: AccountingEventType.LOAN_RECEIVED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.LOANS,
        sourceType: 'Liability',
        sourceId: liabilityId,
        eventType: AccountingEventType.LOAN_RECEIVED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Loan received',
        dimensions: { loanId: liabilityId },
        lines,
      }),
  });
}

export async function postLoanRepaymentAccounting({
  db,
  tenantId,
  userId,
  paymentId,
  amount,
  date,
  description,
  lines,
  liabilityId = null,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.LOANS,
    eventType: AccountingEventType.LOAN_REPAYMENT_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.LOANS,
        sourceType: 'LiabilityPayment',
        sourceId: paymentId,
        eventType: AccountingEventType.LOAN_REPAYMENT_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Loan repayment',
        dimensions: { loanId: liabilityId },
        lines,
      }),
  });
}

export async function postCapitalContributionAccounting({
  db,
  tenantId,
  userId,
  sourceType = 'capital_contribution',
  sourceId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.EQUITY,
    eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.EQUITY,
        sourceType,
        sourceId,
        eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Capital contribution',
        lines,
      }),
  });
}

export async function postTaxSettlementAccounting({
  db,
  tenantId,
  userId,
  sourceId,
  amount,
  date,
  description,
  lines,
  sourceType = 'TaxPayment',
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.TAX,
    eventType: AccountingEventType.TAX_SETTLEMENT_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.TAX,
        sourceType,
        sourceId,
        eventType: AccountingEventType.TAX_SETTLEMENT_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Tax settlement',
        lines,
      }),
  });
}

export async function postSupplierCreditAccounting({
  db,
  tenantId,
  userId,
  creditId,
  amount,
  date,
  description,
  lines,
  supplierId,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.SUPPLIER_CREDIT_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.PAYABLES,
        sourceType: 'SupplierCredit',
        sourceId: creditId,
        eventType: AccountingEventType.SUPPLIER_CREDIT_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Supplier credit',
        dimensions: { supplierId },
        lines,
      }),
  });
}

export async function postOwnerDrawingAccounting({
  db,
  tenantId,
  userId,
  drawingId,
  amount,
  date,
  description,
  lines,
  currency = 'MWK',
  hasPermission = () => true,
}) {
  const context = contextFromSession({ tenantId, userId, currency });
  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.EQUITY,
    eventType: AccountingEventType.OWNER_DRAWING_POSTED,
    hasPermission,
    buildEngineInput: async () =>
      engineInput({
        sourceModule: AccountingSourceModule.EQUITY,
        sourceType: 'OwnerDrawing',
        sourceId: drawingId,
        eventType: AccountingEventType.OWNER_DRAWING_POSTED,
        date,
        currency,
        totalAmount: amount,
        description: description || 'Owner drawing',
        lines,
      }),
  });
}
