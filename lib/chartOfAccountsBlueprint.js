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
  { code: '2115', name: 'Goods Received Not Invoiced (GRNI)', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true, description: 'Accrued purchases clearing: credit when inventory is received; debit when the supplier bill clears the receipt. Not trade AP.' },
  { code: '2120', name: 'VAT Payable (MRA)', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2130', name: 'PAYE Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2140', name: 'Accrued Expenses', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2150', name: 'Deferred Revenue', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2160', name: 'Short-term Loans', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2170', name: 'Employee Payables', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true, description: 'Staff reimbursements and other amounts due to employees.' },
  { code: '2180', name: 'Credit Card Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2190', name: 'Salaries Payable', type: 'Liability', parentCode: '2100', subtype: 'Current Liability', isSystem: true },
  { code: '2500', name: 'Long-term Liabilities', type: 'Liability', parentCode: '2000', subtype: 'Group', isSystem: true },
  { code: '2510', name: 'Bank Loans (Long-term)', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true },
  { code: '2520', name: 'Shareholder Loans', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true },
  { code: '2999', name: 'All other liabilities (2000–2999)', type: 'Liability', parentCode: '2500', subtype: 'Non-current Liability', isSystem: true, description: 'Catch-all for liability-range codes (2000–2999) pending reclassification.', requiresReclassification: true },
  { code: '3000', name: 'Equity', type: 'Equity', subtype: 'Group', isSystem: true, description: 'Header only — roll-up of equity lines. Post to capital, retained earnings, 3999 suspense, etc.' },
  { code: '3100', name: 'Owner\'s Capital', type: 'Equity', parentCode: '3000', subtype: 'Equity', isSystem: true },
  { code: '3190', name: 'Opening Balance Equity', type: 'Equity', parentCode: '3100', subtype: 'Equity', isSystem: true, description: 'System counter-account for opening balances during onboarding. Protected — do not post manually.', acceptsNewTransactions: false },
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
  { code: '5110', name: 'Purchases', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, description: 'Merchandise and materials purchased for resale or production.' },
  { code: '5120', name: 'Purchase Returns & Discounts', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, normalBalance: 'Credit' },
  { code: '5130', name: 'Freight & Import Costs', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, description: 'Inbound freight and import logistics tied to inventory cost.' },
  { code: '5140', name: 'Direct Labour', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5150', name: 'Subcontractor Costs', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5160', name: 'Project Materials', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true },
  { code: '5170', name: 'Packaging for Resale', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, description: 'Boxes, bags, labels and packing materials that form part of goods sold.' },
  { code: '5180', name: 'Customs Duty & Clearing', type: 'Expense', parentCode: '5100', subtype: 'Cost of Sales', isSystem: true, description: 'Import duty, clearing agents, and border charges on inventory.' },

  // People costs
  { code: '5200', name: 'Salaries & Wages', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Employee salaries and wages.' },
  { code: '5201', name: 'Directors\' Remuneration', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Fees and remuneration paid to directors (companies).' },
  { code: '5202', name: 'Leave Pay Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Leave encashment and leave-pay accruals charged to P&L.' },
  { code: '5205', name: 'Overtime', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5210', name: 'Staff Benefits & Allowances', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5220', name: 'Employer Statutory Contributions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Employer pension/NSSF and other payroll statutory costs.' },
  { code: '5230', name: 'Casual & Temporary Labour', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5240', name: 'Recruitment Costs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5250', name: 'Staff Welfare & Medical', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5260', name: 'Uniforms & Protective Clothing', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5270', name: 'Bonuses & Commissions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5280', name: 'Severance Costs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5290', name: 'Inventory Shrinkage & Write-Off', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Stock losses, spoilage, and write-offs outside COGS purchases.' },

  // Premises & facilities
  { code: '5300', name: 'Rent & Lease', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5305', name: 'Property Rates & Municipal Taxes', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5310', name: 'Utilities', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'General utilities when not split to electricity/water accounts.' },
  { code: '5311', name: 'Electricity', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5312', name: 'Cleaning Services', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5313', name: 'Security Services', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5314', name: 'Waste Collection', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5315', name: 'Telecom & Internet', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Office phone lines, fibre, and ISP bills.' },
  { code: '5316', name: 'Water & Sanitation', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5317', name: 'Generator Fuel & Running', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Diesel/petrol and running costs for standby generators.' },
  { code: '5318', name: 'Business Airtime & Data', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Staff/business mobile airtime and mobile data bundles.' },
  { code: '5320', name: 'Office Supplies', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5321', name: 'Printing & Photocopying', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5322', name: 'Cleaning Materials & Consumables', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5325', name: 'Small Tools & Consumables', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Low-value tools and consumables expensed (not capitalized).' },

  // Selling & marketing
  { code: '5330', name: 'Marketing & Advertising', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5331', name: 'Digital Marketing', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5332', name: 'Events & Sponsorships', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5333', name: 'Sales Commissions Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5334', name: 'Signage & Branding', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5335', name: 'Customer Samples & Promotions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Free samples, promo giveaways, and demo stock given to customers.' },

  // Travel & logistics (operating)
  { code: '5340', name: 'Travel & Transport', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5341', name: 'Fuel & Vehicle Running', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Vehicle fuel and day-to-day running (not generator fuel — use 5317).' },
  { code: '5342', name: 'Vehicle Insurance & Licences', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5343', name: 'Accommodation', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5344', name: 'Domestic Travel', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5345', name: 'Freight & Delivery Out', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Outbound delivery to customers (not inbound inventory freight — use 5130).' },
  { code: '5346', name: 'International Travel', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  // Technology
  { code: '5350', name: 'IT & Hosting', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'General IT when not split to software/hosting/support leaves.' },
  { code: '5351', name: 'Software Subscriptions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5352', name: 'Cloud Hosting', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5353', name: 'IT Support', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  // Professional services
  { code: '5360', name: 'Professional & Legal Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5361', name: 'Accounting & Audit Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5362', name: 'Legal Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5363', name: 'Consultancy Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5364', name: 'Company Secretarial Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Company secretary, filings, and related compliance fees.' },

  // Insurance
  { code: '5370', name: 'Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'General insurance premiums when not split below.' },
  { code: '5371', name: 'Motor Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5372', name: 'Property Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5373', name: 'Public Liability Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5375', name: 'Goods-in-Transit Insurance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  // Repairs
  { code: '5380', name: 'Repairs & Maintenance', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5381', name: 'Building Repairs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5382', name: 'Equipment Repairs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5383', name: 'Motor Vehicle Repairs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  { code: '5390', name: 'Bad Debts', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5400', name: 'Depreciation Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5410', name: 'Amortization Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  // Finance & payments
  { code: '5500', name: 'Bank Charges & Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5505', name: 'Mobile Money Transaction Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Airtel Money / TNM Mpamba send/withdraw and agent fees.' },
  { code: '5510', name: 'Interest Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5515', name: 'Loan Arrangement Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Facility fees and arrangement costs on borrowings (when expensed).' },
  { code: '5520', name: 'Foreign Exchange Losses', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5530', name: 'Merchant & Payment Gateway Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Card acquiring, PayChangu, and similar merchant fees.' },
  { code: '5540', name: 'Penalties & Late Fees', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Commercial late fees and supplier penalties (not tax penalties — use 5560).' },
  { code: '5550', name: 'Business Licences & Permits', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5555', name: 'Withholding Tax Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Non-creditable withholding tax borne as an expense.' },
  { code: '5560', name: 'Tax Penalties & Interest', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5570', name: 'Non-Recoverable VAT', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5580', name: 'Corporate Tax Expense', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  // Other operating
  { code: '5600', name: 'Meals & Entertainment', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5610', name: 'Training & Development', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5620', name: 'Donations & CSR', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5630', name: 'Fines & Penalties', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Regulatory/court fines (prefer 5540/5560 when more specific).' },
  { code: '5640', name: 'Loss on Asset Disposal', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5650', name: 'Postage & Courier', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5660', name: 'Memberships & Subscriptions', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Trade associations, professional body fees, publications (not SaaS — use 5351).' },
  { code: '5670', name: 'Warranty & After-Sales Costs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },
  { code: '5680', name: 'Safety & Compliance Costs', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Workplace safety gear beyond uniforms, inspections, and compliance consumables.' },
  { code: '5690', name: 'Board & Meeting Expenses', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true },

  { code: '5700', name: 'Custom Expenses', type: 'Expense', parentCode: '5000', subtype: 'Group', isSystem: true, description: 'Header for tenant-defined expense accounts (5701–5899).' },
  { code: '5900', name: 'All Other Expenses (5000–5900)', type: 'Expense', parentCode: '5000', subtype: 'Operating Expense', isSystem: true, description: 'Catch-all for expense-range codes (5000–5900) pending reclassification.', requiresReclassification: true },
];

