/**
 * Canonical Chart of Accounts blueprint (hierarchical GL).
 * Five roots under tenant: 1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000 Expenses.
 * Posting conventions: revenue stored as accountType "Income"; AP posts to 2110; cash main 1110;
 * payment-method GL children live under 1120 with codes 1130-xx.
 *
 * consumed by lib/chartOfAccountsInitialization.js and prisma/seed/chartOfAccountsSeed.ts
 */

/** @typedef {'Asset'|'Liability'|'Equity'|'Income'|'Expense'} CoaAccountType */

/**
 * @typedef {Object} CoaBlueprintRow
 * @property {string} code
 * @property {string} name
 * @property {CoaAccountType} type
 * @property {'Debit'|'Credit'} [normalBalance]
 * @property {string} [subtype]
 * @property {string} [parentCode]
 * @property {string} [description]
 * @property {boolean} [isSystem]
 * @property {boolean} [reparentSafe]
 * @property {string[]} [skipCreateIfAnyCodeExists]
 */

/** @type {CoaBlueprintRow[]} */
export const CHART_OF_ACCOUNTS_BLUEPRINT = [
  // —— Assets (1000) ——
  { code: '1000', name: 'Assets', type: 'Asset', normalBalance: 'Debit', subtype: 'Group', description: 'Root for all asset accounts.' },
  { code: '1100', name: 'Current Assets', type: 'Asset', parentCode: '1000', subtype: 'Group', description: 'Cash, receivables, inventory and other current assets.', reparentSafe: true },
  { code: '1110', name: 'Cash - Main Account', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true, description: 'Primary cash on hand.' },
  {
    code: '1120',
    name: 'Cash - Custom Accounts Created in payment accounts',
    type: 'Asset',
    parentCode: '1100',
    subtype: 'Group',
    description: 'GL buckets for POS / payment methods (bank, mobile money, etc.).',
    reparentSafe: true,
  },
  { code: '1130-01', name: 'Airtel Money', type: 'Asset', parentCode: '1120', subtype: 'Current Asset' },
  { code: '1130-02', name: 'TNM Mpamba', type: 'Asset', parentCode: '1120', subtype: 'Current Asset' },
  { code: '1130-03', name: 'NBS Bank', type: 'Asset', parentCode: '1120', subtype: 'Current Asset' },
  { code: '1130-04', name: 'National Bank', type: 'Asset', parentCode: '1120', subtype: 'Current Asset' },
  { code: '1130-05', name: 'Standard Bank', type: 'Asset', parentCode: '1120', subtype: 'Current Asset' },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true, description: 'Trade receivables.', reparentSafe: true },
  { code: '1210', name: 'Prepaid Expenses', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', description: 'Prepayments and deferrals.', skipCreateIfAnyCodeExists: ['1210', '1400'] },
  { code: '1215', name: 'Advances to Suppliers', type: 'Asset', parentCode: '1100', subtype: 'Current Asset' },
  { code: '1300', name: 'Inventory', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', description: 'Inventory control.', reparentSafe: true },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', parentCode: '1000', subtype: 'Non-current Asset' },
  { code: '1510', name: 'Property & Equipment', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1520', name: 'Furniture & Fittings', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1530', name: 'Motor Vehicles', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1540', name: 'Computer Equipment', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset' },
  { code: '1590', name: 'Accumulated Depreciation', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', normalBalance: 'Credit', description: 'Contra-asset.' },
  { code: '1900', name: 'Other Assets', type: 'Asset', parentCode: '1000', subtype: 'Non-current Asset' },
  { code: '1910', name: 'Long-term Deposits', type: 'Asset', parentCode: '1900', subtype: 'Non-current Asset' },
  { code: '1920', name: 'Intangible Assets', type: 'Asset', parentCode: '1900', subtype: 'Non-current Asset' },

  // —— Liabilities (2000) ——
  { code: '2000', name: 'Liabilities', type: 'Liability', normalBalance: 'Credit', subtype: 'Group' },
  {
    code: '2100',
    name: 'Current Liabilities',
    type: 'Liability',
    parentCode: '2000',
    subtype: 'Group',
    description: 'Payables, statutory and other amounts due within one year.',
    isSystem: true,
    reparentSafe: true,
  },
  { code: '2110', name: 'Accounts Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true, description: 'Trade payables.', reparentSafe: true },
  { code: '2120', name: 'VAT Payable (MRA)', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', description: 'Statutory VAT bucket (tax engine may also use 2041).' },
  { code: '2130', name: 'PAYE Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability' },
  { code: '2140', name: 'Accrued Expenses', type: 'Liability', parentCode: '2100', subtype: 'Current Liability' },
  { code: '2150', name: 'Deferred Revenue', type: 'Liability', parentCode: '2100', subtype: 'Current Liability' },
  { code: '2160', name: 'Short-term Loans', type: 'Liability', parentCode: '2100', subtype: 'Current Liability' },
  { code: '2500', name: 'Long-term Liabilities', type: 'Liability', parentCode: '2000', subtype: 'Non-current Liability' },
  { code: '2510', name: 'Bank Loans (Long-term)', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability' },

  // —— Equity (3000) ——
  { code: '3000', name: 'Equity', type: 'Equity', normalBalance: 'Credit', subtype: 'Group' },
  { code: '3100', name: "Owner's Capital", type: 'Equity', parentCode: '3000', subtype: 'Equity' },
  {
    code: '500000',
    name: 'Capital Account',
    type: 'Equity',
    parentCode: '3100',
    normalBalance: 'Credit',
    subtype: 'Capital',
    description: 'Parent GL for owner contributions.',
    isSystem: true,
    reparentSafe: true,
  },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', parentCode: '3000', subtype: 'Equity' },
  { code: '3300', name: 'Current Year Earnings', type: 'Equity', parentCode: '3000', subtype: 'Equity', reparentSafe: true },
  { code: '3999', name: 'Opening Balances Suspense', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true, description: 'System suspense for opening balance workflow.' },

  // —— Revenue (stored as Income) ——
  { code: '4000', name: 'Revenue', type: 'Income', normalBalance: 'Credit', subtype: 'Group' },
  { code: '4100', name: 'Product Sales', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true },
  { code: '4110', name: 'Sales Returns & Allowances', type: 'Income', parentCode: '4000', subtype: 'Operating Income', normalBalance: 'Debit', description: 'Contra-revenue.' },
  { code: '4150', name: 'Service Revenue', type: 'Income', parentCode: '4000', subtype: 'Operating Income' },

  // —— Expenses (5000) ——
  { code: '5000', name: 'Expenses', type: 'Expense', normalBalance: 'Debit', subtype: 'Group' },
  { code: '5100', name: 'Cost of Sales', type: 'Expense', parentCode: '5000', subtype: 'Group' },
  { code: '5110', name: 'Purchases', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales' },
  { code: '5120', name: 'Purchase Returns & Discounts', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', normalBalance: 'Credit', description: 'Contra-expense.' },
  { code: '5130', name: 'Freight & Import Costs', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales' },
  { code: '5140', name: 'Direct Labour', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales' },
  { code: '5200', name: 'Salaries & Wages', type: 'Expense', parentCode: '5000', subtype: 'Group' },
  { code: '5201', name: 'Admin & Management Salaries', type: 'Expense', parentCode: '5200', subtype: 'Operating Expense', isSystem: true },
  { code: '5202', name: 'Sales & Distribution Wages', type: 'Expense', parentCode: '5200', subtype: 'Operating Expense' },
  { code: '5203', name: 'Production & Operations Wages', type: 'Expense', parentCode: '5200', subtype: 'Operating Expense' },
  { code: '5210', name: 'Employer PAYE & Contributions', type: 'Expense', parentCode: '5200', subtype: 'Operating Expense' },
  { code: '5300', name: 'Rent & Lease', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5310', name: 'Utilities', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5320', name: 'Office Supplies', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5330', name: 'Marketing & Advertising', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5340', name: 'Travel & Transport', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5400', name: 'Depreciation Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5500', name: 'Bank Charges & Interest', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
  { code: '5900', name: 'Other Expenses', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense' },
];
