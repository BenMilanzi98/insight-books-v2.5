/**
 * Canonical Chart of Accounts blueprint (hierarchical GL).
 * Merged from platform export (2026-06) + extended bank/mobile/receivable accounts.
 * Five roots: 1000 Assets, 2000 Liabilities, 3000 Equity, 4000 Revenue, 5000 Expenses.
 * All accounts are system-managed (isSystem: true) and provisioned automatically for new tenants.
 *
 * Posting conventions: cash GL uses 1110; Malawi banks 1131–1138 under 1130; mobile money 1140/1141; POS clearing 1145.
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
 * @property {boolean} [requiresReclassification]
 */

/** @type {CoaBlueprintRow[]} */
export const CHART_OF_ACCOUNTS_BLUEPRINT = [
  { code: '1000', name: 'Assets', type: 'Asset', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of asset children. Do not post journals here.' },
  { code: '1100', name: 'Current Assets', type: 'Asset', parentCode: '1000', subtype: 'Group', isSystem: true },
  { code: '1110', name: 'Cash - Main Account', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true, description: 'Primary cash on hand — all cash GL postings use this account.' },
  { code: '1120', name: 'Cash - Petty Cash', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true, description: 'Till float and petty cash.' },
  { code: '1130', name: 'Bank - Primary', type: 'Asset', parentCode: '1100', subtype: 'Group', isSystem: true, description: 'Parent for Malawi bank GL accounts (1131–1138). Bare 1130 is rollup-only.' },
  { code: '1131', name: 'National Bank of Malawi', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1131-01, …). No direct postings.' },
  { code: '1132', name: 'Standard Bank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1132-01, …). No direct postings.' },
  { code: '1133', name: 'FDH Bank', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1133-01, …). No direct postings.' },
  { code: '1134', name: 'NBS Bank', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1134-01, …). No direct postings.' },
  { code: '1135', name: 'First Capital Bank', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1135-01, …). No direct postings.' },
  { code: '1136', name: 'Ecobank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1136-01, …). No direct postings.' },
  { code: '1137', name: 'Centenary Bank Malawi', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1137-01, …). No direct postings.' },
  { code: '1138', name: 'CDH Investment Bank', type: 'Asset', parentCode: '1130', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1138-01, …). No direct postings.' },
  { code: '1140', name: 'Mobile Money - Airtel Money', type: 'Asset', parentCode: '1100', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1140-01, …). No direct postings.' },
  { code: '1141', name: 'Mobile Money - TNM Mpamba', type: 'Asset', parentCode: '1100', subtype: 'Group', isSystem: true, description: 'Rollup parent — post to child accounts (1141-01, …). No direct postings.' },
  { code: '1145', name: 'POS Card Clearing', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1200', name: 'Accounts Receivable', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true, description: 'Trade receivables.' },
  { code: '1210', name: 'Prepaid Expenses', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1215', name: 'Advances to Suppliers', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1216', name: 'Salary Advance Receivable', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1218', name: 'Insurance Receivable — Control', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1240', name: 'VAT Recoverable', type: 'Asset', parentCode: '1100', subtype: 'Current Asset', isSystem: true },
  { code: '1300', name: 'Inventory', type: 'Asset', parentCode: '1100', subtype: 'Group', isSystem: true },
  { code: '1310', name: 'Stock on Hand', type: 'Asset', parentCode: '1300', subtype: 'Current Asset', isSystem: true },
  { code: '1320', name: 'Raw Materials', type: 'Asset', parentCode: '1300', subtype: 'Current Asset', isSystem: true },
  { code: '1330', name: 'Goods in Transit', type: 'Asset', parentCode: '1300', subtype: 'Current Asset', isSystem: true },
  { code: '1500', name: 'Fixed Assets', type: 'Asset', parentCode: '1000', subtype: 'Group', isSystem: true },
  { code: '1510', name: 'Property & Equipment', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', isSystem: true },
  { code: '1520', name: 'Furniture & Fittings', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', isSystem: true },
  { code: '1530', name: 'Motor Vehicles', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', isSystem: true },
  { code: '1540', name: 'Computer Equipment', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', isSystem: true },
  { code: '1590', name: 'Accumulated Depreciation', type: 'Asset', parentCode: '1500', subtype: 'Non-current Asset', isSystem: true, normalBalance: 'Credit' },
  { code: '1900', name: 'Other Assets', type: 'Asset', parentCode: '1000', subtype: 'Group', isSystem: true },
  { code: '1910', name: 'Long-term Deposits', type: 'Asset', parentCode: '1900', subtype: 'Non-current Asset', isSystem: true },
  { code: '1920', name: 'Intangible Assets', type: 'Asset', parentCode: '1900', subtype: 'Non-current Asset', isSystem: true },
  { code: '1999', name: 'All other assets (1000–1999)', type: 'Asset', parentCode: '1900', subtype: 'Non-current Asset', isSystem: true, description: 'Catch-all for asset-range codes (1000–1999) pending reclassification.', requiresReclassification: true },
  { code: '2000', name: 'Liabilities', type: 'Liability', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of liability children. Post to AP, loans, statutory accounts, etc.' },
  { code: '2041', name: 'Tax Inflow (Collected)', type: 'Liability', parentCode: '2000', subtype: 'Group', isSystem: true, acceptsNewTransactions: false, description: 'Roll-up parent for taxes collected (2041-01 …). Post to child accounts only.' },
  { code: '2045', name: 'Tax Outflow (Paid)', type: 'Liability', parentCode: '2000', subtype: 'Group', isSystem: true, acceptsNewTransactions: false, description: 'Roll-up parent for taxes paid / input VAT (2045-01 …). Post to child accounts only.' },
  { code: '2100', name: 'Current Liabilities', type: 'Liability', parentCode: '2000', subtype: 'Group', isSystem: true },
  { code: '2110', name: 'Accounts Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true, description: 'Trade payables.' },
  { code: '2120', name: 'VAT Payable (MRA)', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2130', name: 'PAYE Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2140', name: 'Accrued Expenses', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2150', name: 'Deferred Revenue', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2160', name: 'Short-term Loans', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2500', name: 'Long-term Liabilities', type: 'Liability', parentCode: '2000', subtype: 'Group', isSystem: true },
  { code: '2510', name: 'Bank Loans (Long-term)', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true },
  { code: '2520', name: 'Shareholder Loans', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true },
  { code: '2999', name: 'All other liabilities (2000–2999)', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true, description: 'Catch-all for liability-range codes (2000–2999) pending reclassification.', requiresReclassification: true },
  { code: '3000', name: 'Equity', type: 'Equity', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of equity lines. Post to capital, retained earnings, 3999 suspense, etc.' },
  { code: '3100', name: 'Owner\'s Capital', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true },
  { code: '3300', name: 'Current Year Earnings', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true },
  { code: '3999', name: 'Opening Balances Suspense', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true, description: 'System suspense for opening balance workflow.' },
  { code: '4000', name: 'Revenue', type: 'Income', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of revenue. Post to 4100, 4110, 4300, 4900, etc.' },
  { code: '4100', name: 'Product Sales', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true },
  { code: '4110', name: 'Sales Returns & Allowances', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true, normalBalance: 'Debit' },
  { code: '4150', name: 'Service Revenue', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true },
  { code: '4200', name: 'Subscription Revenue', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true },
  { code: '4300', name: 'Interest & Investment Income', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true },
  { code: '4900', name: 'All Other Incomes (4000–4900)', type: 'Income', parentCode: '4000', subtype: 'Operating Income', isSystem: true, description: 'Catch-all for revenue-range codes (4000–4900) pending reclassification.', requiresReclassification: true },
  { code: '5000', name: 'Expenses', type: 'Expense', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of expense children. Post to COGS subtree, salaries, rent, 5900 other, etc.' },
  { code: '5100', name: 'Cost of Sales', type: 'Expense', parentCode: '5000', subtype: 'Group', isSystem: true },
  { code: '5110', name: 'Purchases', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5120', name: 'Purchase Returns & Discounts', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, normalBalance: 'Credit' },
  { code: '5130', name: 'Freight & Import Costs', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5140', name: 'Direct Labour', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5200', name: 'Salaries & Wages', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Employee salaries and wages.' },
  { code: '5210', name: 'Staff Benefits & Allowances', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5220', name: 'Employer Statutory Contributions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Employer NSSF, pension, and other payroll statutory costs.' },
  { code: '5300', name: 'Rent & Lease', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5310', name: 'Utilities', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5315', name: 'Telecom & Internet', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5320', name: 'Office Supplies', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5330', name: 'Marketing & Advertising', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5340', name: 'Travel & Transport', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5350', name: 'IT & Hosting', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Software, SaaS, cloud hosting, domains, and IT subscriptions.' },
  { code: '5360', name: 'Professional & Legal Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5370', name: 'Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5380', name: 'Repairs & Maintenance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5390', name: 'Bad Debts', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5400', name: 'Depreciation Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5410', name: 'Amortization Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5500', name: 'Bank Charges & Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5510', name: 'Interest Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5600', name: 'Meals & Entertainment', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5610', name: 'Training & Development', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5700', name: 'Custom Expenses', type: 'Expense', parentCode: '5000', subtype: 'Group', isSystem: true, description: 'Header for tenant-defined expense accounts (5701–5899).' },
  { code: '5900', name: 'All Other Expenses (5000–5900)', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Catch-all for expense-range codes (5000–5900) pending reclassification.', requiresReclassification: true },
];
