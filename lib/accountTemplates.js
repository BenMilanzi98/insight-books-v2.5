// lib/accountTemplates.js
/**
 * Account Templates for Common Industries
 * Provides pre-configured chart of accounts for different business types
 */

export const accountTemplates = {
  retail: {
    name: "Retail Store",
    description: "Standard chart of accounts for retail businesses",
    accounts: [
      // Assets
      { code: "1000", name: "Cash", type: "Asset", normalBalance: "Debit" },
      { code: "1010", name: "Cash on Hand", type: "Asset", normalBalance: "Debit" },
      { code: "1020", name: "Bank Account", type: "Asset", normalBalance: "Debit" },
      { code: "1030", name: "Airtel Money", type: "Asset", normalBalance: "Debit" },
      { code: "1040", name: "Mpamba", type: "Asset", normalBalance: "Debit" },
      { code: "1050", name: "PayChangu", type: "Asset", normalBalance: "Debit" },
      { code: "1200", name: "Inventory", type: "Asset", normalBalance: "Debit" },
      { code: "1300", name: "Accounts Receivable", type: "Asset", normalBalance: "Debit" },
      { code: "1500", name: "Equipment", type: "Asset", normalBalance: "Debit" },
      { code: "1501", name: "Accumulated Depreciation - Equipment", type: "Asset", normalBalance: "Credit" },
      { code: "1600", name: "Furniture & Fixtures", type: "Asset", normalBalance: "Debit" },
      { code: "1601", name: "Accumulated Depreciation - Furniture", type: "Asset", normalBalance: "Credit" },
      
      // Liabilities
      { code: "2000", name: "Accounts Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2100", name: "Sales Tax Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2200", name: "Short-term Loans", type: "Liability", normalBalance: "Credit" },
      
      // Equity
      { code: "3000", name: "Owner's Capital", type: "Equity", normalBalance: "Credit" },
      { code: "3100", name: "Retained Earnings", type: "Equity", normalBalance: "Credit" },
      { code: "3200", name: "Current Year Profit/Loss", type: "Equity", normalBalance: "Credit" },
      
      // Revenue
      { code: "4000", name: "Sales Revenue", type: "Revenue", normalBalance: "Credit" },
      { code: "4100", name: "Service Revenue", type: "Revenue", normalBalance: "Credit" },
      { code: "4200", name: "Discounts Given", type: "Revenue", normalBalance: "Debit" },
      
      // Expenses
      { code: "5000", name: "Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5100", name: "Rent Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5200", name: "Utilities Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5230", name: "Salaries Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5400", name: "Advertising Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5500", name: "Office Supplies", type: "Expense", normalBalance: "Debit" },
      { code: "5600", name: "Insurance Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5700", name: "Depreciation Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5800", name: "Bank Charges", type: "Expense", normalBalance: "Debit" },
      { code: "5900", name: "Other Expenses", type: "Expense", normalBalance: "Debit" },
    ],
  },
  
  service: {
    name: "Service Business",
    description: "Chart of accounts for service-based businesses",
    accounts: [
      // Assets
      { code: "1000", name: "Cash", type: "Asset", normalBalance: "Debit" },
      { code: "1010", name: "Cash on Hand", type: "Asset", normalBalance: "Debit" },
      { code: "1020", name: "Bank Account", type: "Asset", normalBalance: "Debit" },
      { code: "1030", name: "Airtel Money", type: "Asset", normalBalance: "Debit" },
      { code: "1040", name: "Mpamba", type: "Asset", normalBalance: "Debit" },
      { code: "1050", name: "PayChangu", type: "Asset", normalBalance: "Debit" },
      { code: "1300", name: "Accounts Receivable", type: "Asset", normalBalance: "Debit" },
      { code: "1400", name: "Prepaid Expenses", type: "Asset", normalBalance: "Debit" },
      { code: "1500", name: "Equipment", type: "Asset", normalBalance: "Debit" },
      { code: "1501", name: "Accumulated Depreciation - Equipment", type: "Asset", normalBalance: "Credit" },
      { code: "1600", name: "Computer Equipment", type: "Asset", normalBalance: "Debit" },
      { code: "1601", name: "Accumulated Depreciation - Computer", type: "Asset", normalBalance: "Credit" },
      
      // Liabilities
      { code: "2000", name: "Accounts Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2100", name: "Sales Tax Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2200", name: "Accrued Expenses", type: "Liability", normalBalance: "Credit" },
      
      // Equity
      { code: "3000", name: "Owner's Capital", type: "Equity", normalBalance: "Credit" },
      { code: "3100", name: "Retained Earnings", type: "Equity", normalBalance: "Credit" },
      { code: "3200", name: "Current Year Profit/Loss", type: "Equity", normalBalance: "Credit" },
      
      // Revenue
      { code: "4000", name: "Service Revenue", type: "Revenue", normalBalance: "Credit" },
      { code: "4100", name: "Consulting Revenue", type: "Revenue", normalBalance: "Credit" },
      { code: "4200", name: "Other Revenue", type: "Revenue", normalBalance: "Credit" },
      
      // Expenses
      { code: "5230", name: "Salaries Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5100", name: "Rent Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5200", name: "Utilities Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5300", name: "Professional Fees", type: "Expense", normalBalance: "Debit" },
      { code: "5400", name: "Marketing & Advertising", type: "Expense", normalBalance: "Debit" },
      { code: "5500", name: "Office Supplies", type: "Expense", normalBalance: "Debit" },
      { code: "5600", name: "Insurance Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5700", name: "Depreciation Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5800", name: "Bank Charges", type: "Expense", normalBalance: "Debit" },
      { code: "5900", name: "Other Expenses", type: "Expense", normalBalance: "Debit" },
    ],
  },
  
  manufacturing: {
    name: "Manufacturing",
    description: "Chart of accounts for manufacturing businesses",
    accounts: [
      // Assets
      { code: "1000", name: "Cash", type: "Asset", normalBalance: "Debit" },
      { code: "1020", name: "Bank Account", type: "Asset", normalBalance: "Debit" },
      { code: "1200", name: "Raw Materials Inventory", type: "Asset", normalBalance: "Debit" },
      { code: "1210", name: "Work in Process Inventory", type: "Asset", normalBalance: "Debit" },
      { code: "1220", name: "Finished Goods Inventory", type: "Asset", normalBalance: "Debit" },
      { code: "1300", name: "Accounts Receivable", type: "Asset", normalBalance: "Debit" },
      { code: "1500", name: "Machinery & Equipment", type: "Asset", normalBalance: "Debit" },
      { code: "1501", name: "Accumulated Depreciation - Machinery", type: "Asset", normalBalance: "Credit" },
      { code: "1600", name: "Buildings", type: "Asset", normalBalance: "Debit" },
      { code: "1601", name: "Accumulated Depreciation - Buildings", type: "Asset", normalBalance: "Credit" },
      
      // Liabilities
      { code: "2000", name: "Accounts Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2100", name: "Sales Tax Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2200", name: "Wages Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2300", name: "Long-term Loans", type: "Liability", normalBalance: "Credit" },
      
      // Equity
      { code: "3000", name: "Owner's Capital", type: "Equity", normalBalance: "Credit" },
      { code: "3100", name: "Retained Earnings", type: "Equity", normalBalance: "Credit" },
      { code: "3200", name: "Current Year Profit/Loss", type: "Equity", normalBalance: "Credit" },
      
      // Revenue
      { code: "4000", name: "Sales Revenue", type: "Revenue", normalBalance: "Credit" },
      
      // Expenses
      { code: "5000", name: "Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5100", name: "Direct Labor", type: "Expense", normalBalance: "Debit" },
      { code: "5200", name: "Manufacturing Overhead", type: "Expense", normalBalance: "Debit" },
      { code: "5300", name: "Rent Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5400", name: "Utilities Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5230", name: "Salaries Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5600", name: "Depreciation Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5700", name: "Insurance Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5800", name: "Maintenance & Repairs", type: "Expense", normalBalance: "Debit" },
    ],
  },
  
  nonprofit: {
    name: "Non-Profit Organization",
    description: "Chart of accounts for non-profit organizations",
    accounts: [
      // Assets
      { code: "1000", name: "Cash", type: "Asset", normalBalance: "Debit" },
      { code: "1020", name: "Bank Account", type: "Asset", normalBalance: "Debit" },
      { code: "1300", name: "Accounts Receivable", type: "Asset", normalBalance: "Debit" },
      { code: "1500", name: "Equipment", type: "Asset", normalBalance: "Debit" },
      { code: "1501", name: "Accumulated Depreciation - Equipment", type: "Asset", normalBalance: "Credit" },
      
      // Liabilities
      { code: "2000", name: "Accounts Payable", type: "Liability", normalBalance: "Credit" },
      { code: "2100", name: "Accrued Expenses", type: "Liability", normalBalance: "Credit" },
      
      // Equity (Net Assets for non-profits)
      { code: "3000", name: "Unrestricted Net Assets", type: "Equity", normalBalance: "Credit" },
      { code: "3100", name: "Temporarily Restricted Net Assets", type: "Equity", normalBalance: "Credit" },
      { code: "3200", name: "Permanently Restricted Net Assets", type: "Equity", normalBalance: "Credit" },
      
      // Revenue
      { code: "4000", name: "Donations", type: "Revenue", normalBalance: "Credit" },
      { code: "4100", name: "Grants", type: "Revenue", normalBalance: "Credit" },
      { code: "4200", name: "Program Revenue", type: "Revenue", normalBalance: "Credit" },
      { code: "4300", name: "Other Revenue", type: "Revenue", normalBalance: "Credit" },
      
      // Expenses
      { code: "5000", name: "Program Expenses", type: "Expense", normalBalance: "Debit" },
      { code: "5100", name: "Administrative Expenses", type: "Expense", normalBalance: "Debit" },
      { code: "5200", name: "Fundraising Expenses", type: "Expense", normalBalance: "Debit" },
      { code: "5230", name: "Salaries Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5400", name: "Rent Expense", type: "Expense", normalBalance: "Debit" },
      { code: "5500", name: "Utilities Expense", type: "Expense", normalBalance: "Debit" },
    ],
  },
};

/**
 * Get list of available templates
 */
export function getAvailableTemplates() {
  return Object.keys(accountTemplates).map(key => ({
    id: key,
    name: accountTemplates[key].name,
    description: accountTemplates[key].description,
    accountCount: accountTemplates[key].accounts.length,
  }));
}

/**
 * Get template by ID
 */
export function getTemplate(templateId) {
  return accountTemplates[templateId] || null;
}










