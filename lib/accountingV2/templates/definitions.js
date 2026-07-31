/**
 * Posting engine — declarative template catalogue (Phase 4).
 *
 * Definitions for every operational posting template required by the Phase 4
 * catalogue that is NOT yet an implemented pilot. Status DEFINED: the engine
 * refuses to post them (no buildDraft) until Phase 9 module integration
 * implements and activates each one behind readiness checks and feature flags.
 *
 * Each definition captures the accounting contract: conceptual debit/credit
 * structure (via required purposes), source coverage, dimensions and reversal
 * behaviour — so Phase 9 implements against a reviewed, versioned contract.
 */

import { AccountingEventType } from '../domain/enums.js';
import { registerTemplate, TemplateStatus } from './templateRegistry.js';

const define = (template) =>
  registerTemplate({ templateVersion: 1, status: TemplateStatus.DEFINED, ...template });

define({
  templateId: 'CASH_SALE',
  eventType: AccountingEventType.INVENTORY_SOLD,
  supportedSourceTypes: ['Sale'],
  requiredPurposes: ['CASH_ON_HAND', 'SALES_REVENUE', 'VAT_OUTPUT'],
  requiredSourceFields: ['total', 'taxAmount', 'paymentMethod'],
  requiredDimensions: [],
  optionalDimensions: ['customerId', 'branchId', 'bankAccountId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'No posting approval; POS controls govern the source.',
  reversalBehaviour: 'Refund/void events generate mirrored reversals; cost recognition reversed separately.',
  description: 'Dr Cash/Bank/Mobile Money, Cr Sales Revenue, Cr VAT Output. Cost event posts separately (no duplicate cost recognition).',
});

define({
  templateId: 'CUSTOMER_PAYMENT',
  eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED,
  supportedSourceTypes: ['Payment'],
  requiredPurposes: ['ACCOUNTS_RECEIVABLE'],
  requiredSourceFields: ['amount', 'paymentMethod', 'clientId'],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['bankAccountId', 'branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'No posting approval; webhook idempotency mandatory.',
  reversalBehaviour: 'Payment reversal event mirrors lines; allocation reversed with it.',
  description: 'Dr Cash/Bank/Mobile Money, Cr Accounts Receivable (customer dimension).',
});

define({
  templateId: 'CUSTOMER_CREDIT_NOTE',
  eventType: AccountingEventType.CUSTOMER_CREDIT_NOTE_POSTED,
  supportedSourceTypes: ['CreditNote'],
  requiredPurposes: ['SALES_RETURNS', 'VAT_OUTPUT', 'ACCOUNTS_RECEIVABLE'],
  requiredSourceFields: ['total', 'taxAmount', 'clientId'],
  requiredDimensions: ['customerId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['supplierId'],
  approvalRule: 'Credit-note approval required by module policy.',
  reversalBehaviour: 'Reversal event; tax adjustment follows configured tax rules.',
  description: 'Dr Sales Returns, Dr VAT Output adjustment, Cr Accounts Receivable.',
});

define({
  templateId: 'SUPPLIER_BILL',
  eventType: AccountingEventType.SUPPLIER_BILL_POSTED,
  supportedSourceTypes: ['SupplierBill'],
  requiredPurposes: ['ACCOUNTS_PAYABLE', 'VAT_INPUT'],
  requiredSourceFields: ['total', 'taxAmount', 'supplierId', 'lines'],
  requiredDimensions: ['supplierId'],
  optionalDimensions: ['branchId', 'projectId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Bill approval per procurement policy before posting.',
  reversalBehaviour: 'Supplier credit or bill reversal event.',
  description: 'Dr Expense/Inventory/Asset (per source line), Dr VAT Input, Cr Accounts Payable.',
});

define({
  templateId: 'SUPPLIER_PAYMENT',
  eventType: AccountingEventType.SUPPLIER_PAYMENT_POSTED,
  supportedSourceTypes: ['SupplierPayment'],
  requiredPurposes: ['ACCOUNTS_PAYABLE', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount', 'supplierId'],
  requiredDimensions: ['supplierId'],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Payment approval per treasury policy.',
  reversalBehaviour: 'Payment reversal event.',
  description: 'Dr Accounts Payable (supplier dimension), Cr Cash/Bank.',
});

define({
  templateId: 'CASH_EXPENSE',
  eventType: AccountingEventType.EXPENSE_POSTED,
  supportedSourceTypes: ['Expense'],
  requiredPurposes: ['VAT_INPUT'],
  requiredSourceFields: ['amount', 'expenseAccountId'],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'branchId', 'projectId', 'bankAccountId'],
  prohibitedDimensions: [],
  approvalRule: 'Expense approval per module policy.',
  reversalBehaviour: 'Expense reversal event.',
  description: 'Dr Expense (valid expense posting account), Dr VAT Input, Cr Cash/Bank/Mobile Money.',
});

define({
  templateId: 'PAYROLL',
  eventType: AccountingEventType.PAYROLL_POSTED,
  supportedSourceTypes: ['PayrollRun'],
  requiredPurposes: [
    'SALARIES_AND_WAGES',
    'EMPLOYER_PENSION_EXPENSE',
    'PAYE_PAYABLE',
    'PENSION_PAYABLE',
    'SALARY_DEDUCTIONS_PAYABLE',
  ],
  requiredSourceFields: ['grossPay', 'paye', 'pension', 'netPay', 'period'],
  requiredDimensions: [],
  optionalDimensions: ['employeeId', 'branchId', 'departmentId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Payroll approval mandatory before posting.',
  reversalBehaviour: 'Payroll reversal event reverses the full run.',
  description: 'Dr Salaries & Wages (5200 mapping) + employer expenses; Cr PAYE/Pension/Deductions/Payroll Payable.',
});

define({
  templateId: 'INVENTORY_PURCHASE',
  eventType: AccountingEventType.INVENTORY_RECEIVED,
  supportedSourceTypes: ['GoodsReceipt', 'SupplierBill'],
  requiredPurposes: ['INVENTORY', 'VAT_INPUT', 'ACCOUNTS_PAYABLE'],
  requiredSourceFields: ['total', 'lines'],
  requiredDimensions: [],
  optionalDimensions: ['supplierId', 'inventoryLocationId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Procurement approval per module policy.',
  reversalBehaviour: 'Goods-return event.',
  description: 'Dr Inventory, Dr VAT Input, Cr Accounts Payable or Bank.',
});

define({
  templateId: 'COST_OF_SALES',
  eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED,
  supportedSourceTypes: ['Sale', 'Invoice'],
  requiredPurposes: ['COST_OF_SALES', 'INVENTORY'],
  requiredSourceFields: ['costAmount', 'valuationMethod'],
  requiredDimensions: [],
  optionalDimensions: ['inventoryLocationId', 'branchId'],
  prohibitedDimensions: [],
  approvalRule: 'System-generated with the sale; no separate approval.',
  reversalBehaviour: 'Reversed together with the driving sale event.',
  description: 'Dr Cost of Sales, Cr Inventory at the approved valuation method. One cost recognition per sale event.',
});

define({
  templateId: 'ASSET_ACQUISITION',
  eventType: AccountingEventType.ASSET_ACQUIRED,
  supportedSourceTypes: ['Asset'],
  requiredPurposes: ['FIXED_ASSET', 'VAT_INPUT', 'ACCOUNTS_PAYABLE'],
  requiredSourceFields: ['cost', 'assetId'],
  requiredDimensions: ['assetId'],
  optionalDimensions: ['supplierId', 'branchId'],
  prohibitedDimensions: ['customerId'],
  approvalRule: 'Asset acquisition approval per capex policy.',
  reversalBehaviour: 'Disposal or acquisition reversal event.',
  description: 'Dr Fixed Asset, Dr VAT Input, Cr Accounts Payable or Bank.',
});

define({
  templateId: 'DEPRECIATION',
  eventType: AccountingEventType.DEPRECIATION_POSTED,
  supportedSourceTypes: ['DepreciationRun'],
  requiredPurposes: ['DEPRECIATION_EXPENSE', 'ACCUMULATED_DEPRECIATION'],
  requiredSourceFields: ['amount', 'period', 'assetId'],
  requiredDimensions: ['assetId'],
  optionalDimensions: ['branchId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Depreciation run approval per fixed-asset policy.',
  reversalBehaviour: 'Depreciation reversal event.',
  description: 'Dr Depreciation Expense, Cr Accumulated Depreciation.',
});

define({
  templateId: 'LOAN_RECEIPT',
  eventType: AccountingEventType.LOAN_RECEIVED,
  supportedSourceTypes: ['Liability', 'Loan'],
  requiredPurposes: ['PRIMARY_BANK', 'LOAN_LIABILITY'],
  requiredSourceFields: ['principal', 'loanId'],
  requiredDimensions: ['loanId'],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Loan registration approval per treasury policy.',
  reversalBehaviour: 'Loan reversal event.',
  description: 'Dr Bank, Cr Loan Liability. Loan proceeds are never revenue.',
});

define({
  templateId: 'LOAN_REPAYMENT',
  eventType: AccountingEventType.LOAN_REPAYMENT_POSTED,
  supportedSourceTypes: ['LiabilityPayment', 'LoanRepayment'],
  requiredPurposes: ['LOAN_LIABILITY', 'INTEREST_EXPENSE', 'PRIMARY_BANK'],
  requiredSourceFields: ['principalAmount', 'interestAmount', 'loanId'],
  requiredDimensions: ['loanId'],
  optionalDimensions: ['bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Payment approval per treasury policy.',
  reversalBehaviour: 'Repayment reversal event.',
  description: 'Dr Loan Liability (principal), Dr Interest Expense (interest), Cr Bank. Principal and interest separated.',
});

define({
  templateId: 'CAPITAL_CONTRIBUTION',
  eventType: AccountingEventType.CAPITAL_CONTRIBUTION_POSTED,
  supportedSourceTypes: ['CapitalContribution'],
  requiredPurposes: ['OWNER_CAPITAL'],
  requiredSourceFields: ['amount', 'ownerId'],
  requiredDimensions: [],
  optionalDimensions: ['ownerId', 'shareholderId', 'bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Capital approval (capital.approve) required.',
  reversalBehaviour: 'Capital reversal event with equity authorization.',
  description: 'Dr Cash/Bank/Asset, Cr Owner Capital / Share Capital / Capital Contributions. Never revenue.',
});

define({
  templateId: 'OWNER_DRAWING',
  eventType: AccountingEventType.OWNER_DRAWING_POSTED,
  supportedSourceTypes: ['OwnerDrawing'],
  requiredPurposes: ['OWNER_DRAWINGS'],
  requiredSourceFields: ['amount', 'ownerId'],
  requiredDimensions: [],
  optionalDimensions: ['ownerId', 'shareholderId', 'bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Drawing approval per equity policy.',
  reversalBehaviour: 'Drawing reversal event.',
  description: 'Dr Owner Drawings (equity, debit-normal), Cr Cash/Bank/Asset. Never an operating expense.',
});

define({
  templateId: 'DIVIDEND_DECLARATION',
  eventType: AccountingEventType.DIVIDEND_DECLARED,
  supportedSourceTypes: ['DividendDeclaration'],
  requiredPurposes: ['RETAINED_EARNINGS', 'DIVIDENDS_PAYABLE'],
  requiredSourceFields: ['amount', 'declarationDate'],
  requiredDimensions: [],
  optionalDimensions: ['shareholderId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Board/owner approval mandatory.',
  reversalBehaviour: 'Declaration reversal before payment only.',
  description: 'Dr Retained Earnings (or Dividends Declared), Cr Dividends Payable.',
});

define({
  templateId: 'DIVIDEND_PAYMENT',
  eventType: AccountingEventType.DIVIDEND_PAID,
  supportedSourceTypes: ['DividendPayment'],
  requiredPurposes: ['DIVIDENDS_PAYABLE', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount', 'declarationId'],
  requiredDimensions: [],
  optionalDimensions: ['shareholderId', 'bankAccountId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Payment approval per treasury policy.',
  reversalBehaviour: 'Payment reversal event.',
  description: 'Dr Dividends Payable, Cr Bank.',
});

define({
  templateId: 'BANK_CHARGE',
  eventType: AccountingEventType.BANK_CHARGE_POSTED,
  supportedSourceTypes: ['BankTransaction', 'BankCharge'],
  requiredPurposes: ['BANK_CHARGES', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount', 'bankAccountId'],
  requiredDimensions: ['bankAccountId'],
  optionalDimensions: [],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'No approval; sourced from bank reconciliation.',
  reversalBehaviour: 'Bank-charge reversal event.',
  description: 'Dr Bank Charges Expense, Cr Bank.',
});

define({
  templateId: 'INTEREST_INCOME',
  eventType: AccountingEventType.INTEREST_INCOME_POSTED,
  supportedSourceTypes: ['BankTransaction'],
  requiredPurposes: ['OTHER_INCOME', 'PRIMARY_BANK'],
  requiredSourceFields: ['amount', 'bankAccountId'],
  requiredDimensions: ['bankAccountId'],
  optionalDimensions: [],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'No approval; sourced from bank reconciliation.',
  reversalBehaviour: 'Interest reversal event.',
  description: 'Dr Bank, Cr Interest Income.',
});

define({
  templateId: 'OPENING_STOCK',
  eventType: AccountingEventType.OPENING_STOCK_POSTED,
  supportedSourceTypes: ['OpeningStockBatch'],
  requiredPurposes: ['INVENTORY', 'OPENING_BALANCE_EQUITY'],
  requiredSourceFields: ['lines', 'valuationSupport'],
  requiredDimensions: [],
  optionalDimensions: ['inventoryLocationId'],
  prohibitedDimensions: ['customerId', 'supplierId'],
  approvalRule: 'Approval mandatory; quantity and valuation support required.',
  reversalBehaviour: 'Correction via reversal or authorized adjustment.',
  description: 'Dr Inventory, Cr Opening Balance Equity, with quantity and valuation evidence.',
});
