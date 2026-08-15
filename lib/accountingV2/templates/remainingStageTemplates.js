/**
 * Phase 9 Stages 3C–6 — ACTIVE v2 templates for remaining modules.
 * Complex operational journals pass balanced lines via command.metadata.lines
 * (built by the live module) so payroll/loan/asset logic is not duplicated.
 */

import { createJournalDraft, createJournalLineDraft } from '../domain/journalDraft.js';
import { money } from '../domain/money.js';
import { AccountingEventType } from '../domain/enums.js';
import { PostingTemplateValidationError } from '../domain/errors.js';
import { registerTemplate, TemplateStatus } from './templateRegistry.js';

function draftBase({ command, lines, templateId, description }) {
  return createJournalDraft({
    description: command.description ?? description,
    transactionDate: command.transactionDate,
    postingDate: command.requestedPostingDate ?? command.transactionDate,
    sourceReference: command.sourceReference,
    currency: command.currency,
    exchangeRate: command.exchangeRate,
    dimensions: command.dimensions,
    lines,
    metadata: { ...command.metadata, templateId },
  });
}

async function buildFromMetadataLines({ command, templateId, description }) {
  const currency = command.currency;
  const raw = command.metadata?.lines;
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new PostingTemplateValidationError([
      { path: 'metadata.lines', message: 'balanced journal lines required' },
    ]);
  }
  const lines = raw.map((line, i) => {
    const d = Number(line.debitAmount ?? line.debit ?? 0);
    const c = Number(line.creditAmount ?? line.credit ?? 0);
    return createJournalLineDraft({
      accountId: line.accountId,
      debit: d > 0 ? d.toFixed(2) : undefined,
      credit: c > 0 ? c.toFixed(2) : undefined,
      currency,
      sequence: line.lineNumber || i + 1,
      description: line.description || description,
      dimensions: line.dimensions || command.dimensions,
    });
  });
  return draftBase({ command, lines, templateId, description });
}

function twoLinePurposeDraft({
  command,
  resolvePurpose,
  debitPurpose,
  creditPurpose,
  debitAccountId,
  creditAccountId,
  templateId,
  description,
}) {
  return async () => {
    const currency = command.currency;
    const amount = money(String(command.totalAmount), currency);
    if (amount.minor <= 0) {
      throw new PostingTemplateValidationError([{ path: 'totalAmount', message: 'must be positive' }]);
    }
    const debit = debitAccountId ? { id: debitAccountId } : await resolvePurpose(debitPurpose);
    const credit = creditAccountId ? { id: creditAccountId } : await resolvePurpose(creditPurpose);
    return draftBase({
      command,
      templateId,
      description,
      lines: [
        createJournalLineDraft({
          accountId: debit.id,
          debit: amount.decimal,
          currency,
          sequence: 1,
          description,
          dimensions: command.dimensions,
        }),
        createJournalLineDraft({
          accountId: credit.id,
          credit: amount.decimal,
          currency,
          sequence: 2,
          description,
          dimensions: command.dimensions,
        }),
      ],
    });
  };
}

/* ── Bank transfer / POS cash deposit ─────────────────────────────────────── */

registerTemplate({
  templateId: 'BANK_TRANSFER',
  templateVersion: 2,
  eventType: AccountingEventType.BANK_TRANSFER_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: [
    'Transfer',
    'PosCashDeposit',
    'BankTransfer',
    'PosCashDayOpen',
    'PosCashDayClose',
  ],
  requiredPurposes: ['PRIMARY_BANK', 'CASH_ON_HAND'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['bankAccountId', 'branchId'],
  prohibitedDimensions: [],
  approvalRule: 'Treasury / POS deposit controls.',
  reversalBehaviour: 'Transfer reversal event.',
  description: 'Dr destination cash/bank, Cr source cash/bank.',
  buildDraft: async ({ command, resolvePurpose }) => {
    if (command.metadata?.lines) {
      return buildFromMetadataLines({ command, templateId: 'BANK_TRANSFER', description: 'Bank transfer' });
    }
    return (
      await twoLinePurposeDraft({
        command,
        resolvePurpose,
        debitPurpose: 'PRIMARY_BANK',
        creditPurpose: 'CASH_ON_HAND',
        debitAccountId: command.metadata?.toAccountId,
        creditAccountId: command.metadata?.fromAccountId,
        templateId: 'BANK_TRANSFER',
        description: command.description || 'Bank transfer',
      })
    )();
  },
});

/* ── Tax settlement ───────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'EXPENSE_PAYMENT',
  templateVersion: 1,
  eventType: AccountingEventType.EXPENSE_PAYMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['ExpensePayment'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'branchId'],
  prohibitedDimensions: [],
  approvalRule: 'Expense payment approval per policy.',
  reversalBehaviour: 'Expense payment reversal.',
  description: 'Dr AP / Employee Payable / Credit Card Payable, Cr Cash or Bank.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'EXPENSE_PAYMENT',
      description: command.description || 'Expense payment',
    }),
});

registerTemplate({
  templateId: 'TAX_SETTLEMENT',
  templateVersion: 2,
  eventType: AccountingEventType.TAX_SETTLEMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: [
    'TaxPayment',
    'Tax-Invoice',
    'Tax-Sale',
    'Tax-Expense',
    'Tax-Purchase',
    'Tax-CreditNote',
    'Tax-Refund',
    'TaxOffset',
    'SupplierPurchase',
    'OpeningBalance',
    'CitProvision',
  ],
  requiredPurposes: ['VAT_OUTPUT', 'PRIMARY_BANK'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Tax payment approval per compliance policy.',
  reversalBehaviour: 'Tax payment reversal.',
  description: 'Dr Tax liability, Cr Bank (or reverse for recoverable taxes).',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'TAX_SETTLEMENT',
      description: command.description || 'Tax settlement',
    }),
});

/* ── Payroll ──────────────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'PAYROLL',
  templateVersion: 2,
  eventType: AccountingEventType.PAYROLL_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Payroll', 'PayrollRun'],
  requiredPurposes: ['SALARIES_AND_WAGES', 'PAYE_PAYABLE'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['employeeId', 'branchId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Payroll approval mandatory before posting.',
  reversalBehaviour: 'Payroll reversal event.',
  description: 'Dr Salaries & related; Cr PAYE/Pension/Net pay / advances.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'PAYROLL',
      description: command.description || 'Payroll',
    }),
});

registerTemplate({
  templateId: 'SALARY_ADVANCE_DISBURSEMENT',
  templateVersion: 1,
  eventType: AccountingEventType.SALARY_ADVANCE_DISBURSED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['SalaryAdvance'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['employeeId', 'branchId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Advance approval before disbursement.',
  reversalBehaviour: 'Advance disbursement reversal restores cash and receivable.',
  description: 'Dr Employee Advances Receivable; Cr Cash/Bank. Not salary expense.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'SALARY_ADVANCE_DISBURSEMENT',
      description: command.description || 'Salary Advance',
    }),
});

registerTemplate({
  templateId: 'RENTAL_CUSTOMER_DEPOSIT',
  templateVersion: 1,
  eventType: AccountingEventType.RENTAL_CUSTOMER_DEPOSIT,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['RentalDeposit'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['customerId', 'branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'Deposit receipt against approved contract.',
  reversalBehaviour: 'Deposit reversal / refund.',
  description: 'Dr Cash/Bank; Cr Customer Rental Deposits Liability. Not rental revenue.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'RENTAL_CUSTOMER_DEPOSIT',
      description: command.description || 'Customer rental deposit',
    }),
});

registerTemplate({
  templateId: 'HIRE_SUPPLIER_DEPOSIT',
  templateVersion: 1,
  eventType: AccountingEventType.HIRE_SUPPLIER_DEPOSIT,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['HireSupplierDeposit'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Supplier deposit payment approval.',
  reversalBehaviour: 'Deposit refund / apply.',
  description: 'Dr Supplier Hire Deposits Asset; Cr Cash/Bank. Not hire expense.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'HIRE_SUPPLIER_DEPOSIT',
      description: command.description || 'Supplier hire deposit',
    }),
});

registerTemplate({
  templateId: 'HIRE_COST_ACCRUAL',
  templateVersion: 1,
  eventType: AccountingEventType.HIRE_COST_ACCRUAL,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['HireAccrual'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'projectId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Approved usage before accrual.',
  reversalBehaviour: 'Clear accrual when bill posts.',
  description: 'Dr Hire Expense/Project Cost; Cr Accrued Hire Liability.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'HIRE_COST_ACCRUAL',
      description: command.description || 'Hire cost accrual',
    }),
});

registerTemplate({
  templateId: 'HIRE_ACCRUAL_CLEARED',
  templateVersion: 1,
  eventType: AccountingEventType.HIRE_ACCRUAL_CLEARED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['HireAccrualClear'],
  requiredPurposes: [],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'projectId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Supplier bill matched to accrual.',
  reversalBehaviour: 'Re-accrue if bill voided.',
  description: 'Dr Accrued Hire Liability; Cr Hire Expense (clear before/with bill expense).',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'HIRE_ACCRUAL_CLEARED',
      description: command.description || 'Hire accrual cleared',
    }),
});

/* ── Asset acquisition ────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'ASSET_ACQUISITION',
  templateVersion: 2,
  eventType: AccountingEventType.ASSET_ACQUIRED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Asset'],
  requiredPurposes: ['FIXED_ASSET'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['assetId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Capex approval per policy.',
  reversalBehaviour: 'Disposal or acquisition reversal.',
  description: 'Dr Fixed Asset, Cr Bank or Owner Capital.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'ASSET_ACQUISITION',
      description: command.description || 'Asset acquisition',
    }),
});

/* ── Depreciation ─────────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'DEPRECIATION',
  templateVersion: 2,
  eventType: AccountingEventType.DEPRECIATION_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['DepreciationRun', 'DepreciationSchedule', 'Asset'],
  requiredPurposes: ['DEPRECIATION_EXPENSE', 'ACCUMULATED_DEPRECIATION'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['assetId'],
  prohibitedDimensions: [],
  approvalRule: 'Depreciation run approval.',
  reversalBehaviour: 'Depreciation reversal.',
  description: 'Dr Depreciation Expense, Cr Accumulated Depreciation.',
  buildDraft: async ({ command, resolvePurpose }) => {
    if (command.metadata?.lines) {
      return buildFromMetadataLines({
        command,
        templateId: 'DEPRECIATION',
        description: 'Depreciation',
      });
    }
    return (
      await twoLinePurposeDraft({
        command,
        resolvePurpose,
        debitPurpose: 'DEPRECIATION_EXPENSE',
        creditPurpose: 'ACCUMULATED_DEPRECIATION',
        templateId: 'DEPRECIATION',
        description: command.description || 'Depreciation',
      })
    )();
  },
});

/* ── Asset disposal ───────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'ASSET_DISPOSAL',
  templateVersion: 2,
  eventType: AccountingEventType.ASSET_DISPOSED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['AssetDisposal', 'Asset'],
  requiredPurposes: ['FIXED_ASSET', 'ACCUMULATED_DEPRECIATION'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['assetId'],
  prohibitedDimensions: [],
  approvalRule: 'Disposal approval per FA policy.',
  reversalBehaviour: 'Disposal reversal.',
  description: 'Clear cost/accum dep; recognize proceeds and gain/loss.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'ASSET_DISPOSAL',
      description: command.description || 'Asset disposal',
    }),
});

/* ── Loan received / repayment ────────────────────────────────────────────── */

registerTemplate({
  templateId: 'LOAN_RECEIPT',
  templateVersion: 2,
  eventType: AccountingEventType.LOAN_RECEIVED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['Liability', 'Loan', 'liability_opening'],
  requiredPurposes: ['PRIMARY_BANK', 'LOAN_LIABILITY'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['loanId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Loan registration approval.',
  reversalBehaviour: 'Loan reversal.',
  description: 'Dr Bank, Cr Loan Liability.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'LOAN_RECEIPT',
      description: command.description || 'Loan received',
    }),
});

registerTemplate({
  templateId: 'LOAN_REPAYMENT',
  templateVersion: 2,
  eventType: AccountingEventType.LOAN_REPAYMENT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['LiabilityPayment', 'LoanRepayment'],
  requiredPurposes: ['LOAN_LIABILITY', 'PRIMARY_BANK'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['loanId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Payment approval per treasury.',
  reversalBehaviour: 'Repayment reversal.',
  description: 'Dr Liability (+ interest expense), Cr Bank.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'LOAN_REPAYMENT',
      description: command.description || 'Loan repayment',
    }),
});

/* ── Equity ───────────────────────────────────────────────────────────────── */

registerTemplate({
  templateId: 'CAPITAL_CONTRIBUTION',
  templateVersion: 2,
  eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['capital_contribution', 'CapitalContribution', 'PaymentAdjustment'],
  requiredPurposes: ['OWNER_CAPITAL', 'CASH_ON_HAND'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['ownerId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Capital approval required.',
  reversalBehaviour: 'Capital reversal.',
  description: 'Dr Cash/Bank/Asset, Cr Owner Capital.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'CAPITAL_CONTRIBUTION',
      description: command.description || 'Capital contribution',
    }),
});

registerTemplate({
  templateId: 'OWNER_DRAWING',
  templateVersion: 2,
  eventType: AccountingEventType.OWNER_DRAWING_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['OwnerDrawing'],
  requiredPurposes: ['OWNER_DRAWINGS', 'CASH_ON_HAND'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['ownerId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Drawing approval per equity policy.',
  reversalBehaviour: 'Drawing reversal.',
  description: 'Dr Owner Drawings, Cr Cash/Bank.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'OWNER_DRAWING',
      description: command.description || 'Owner drawing',
    }),
});

registerTemplate({
  templateId: 'DIVIDEND_DECLARATION',
  templateVersion: 2,
  eventType: AccountingEventType.DIVIDEND_DECLARED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['DividendDeclaration'],
  requiredPurposes: ['RETAINED_EARNINGS', 'DIVIDENDS_PAYABLE'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['shareholderId'],
  prohibitedDimensions: [],
  approvalRule: 'Board/owner approval.',
  reversalBehaviour: 'Declaration reversal before payment.',
  description: 'Dr Retained Earnings, Cr Dividends Payable.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'DIVIDEND_DECLARATION',
      description: command.description || 'Dividend declared',
    }),
});

registerTemplate({
  templateId: 'DIVIDEND_PAYMENT',
  templateVersion: 2,
  eventType: AccountingEventType.DIVIDEND_PAID,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['DividendPayment'],
  requiredPurposes: ['DIVIDENDS_PAYABLE', 'PRIMARY_BANK'],
  requiredSourceFields: [],
  requiredDimensions: [],
  optionalDimensions: ['shareholderId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Payment approval.',
  reversalBehaviour: 'Dividend payment reversal.',
  description: 'Dr Dividends Payable, Cr Bank.',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'DIVIDEND_PAYMENT',
      description: command.description || 'Dividend paid',
    }),
});

/* ── Supplier credit (ready; no live API yet) ─────────────────────────────── */

registerTemplate({
  templateId: 'SUPPLIER_CREDIT',
  templateVersion: 2,
  eventType: AccountingEventType.SUPPLIER_CREDIT_POSTED,
  status: TemplateStatus.ACTIVE,
  supportedSourceTypes: ['SupplierCredit'],
  requiredPurposes: ['ACCOUNTS_PAYABLE'],
  requiredSourceFields: [],
  requiredDimensions: ['supplierId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Procurement credit approval.',
  reversalBehaviour: 'Supplier credit reversal.',
  description: 'Dr Accounts Payable, Cr Expense/Inventory/Asset (+ VAT).',
  buildDraft: async ({ command }) =>
    buildFromMetadataLines({
      command,
      templateId: 'SUPPLIER_CREDIT',
      description: command.description || 'Supplier credit',
    }),
});
