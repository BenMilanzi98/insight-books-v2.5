import { REPORT_TYPES } from '@/lib/accountingV2/reporting/reportTypes';

export const REPORTS_DASHBOARD_TYPE = 'REPORTS_DASHBOARD';

export const REPORT_CATEGORIES = [
  {
    name: 'Overview',
    reports: [
      {
        type: REPORTS_DASHBOARD_TYPE,
        name: 'Dashboard',
        description: 'Financial summary, trends, and quick links to every report.',
      },
    ],
  },
  {
    name: 'Core Accounting',
    reports: [
      { type: 'INCOME_STATEMENT', name: 'Profit & Loss', description: 'Revenue, COGS, operating expenses, tax and net profit.' },
      { type: 'PROFIT_ANALYSIS', name: 'Profit Analysis', description: 'Product-line profit, trend charts, and category budget variance — same analysis as classic Reports.' },
      { type: 'BALANCE_SHEET', name: 'Statement of Financial Position', description: 'Cumulative assets, liabilities and equity as of a date.' },
      { type: 'CASH_FLOW', name: 'Cash Flow Statement', description: 'Operating, investing and financing cash movements (indirect method).' },
    ],
  },
  {
    name: 'Sales and Operations (JE money)',
    reports: [
      { type: 'SALES', name: 'Sales Report', description: 'JE revenue/COGS with POS and invoice insights (top customers, products, trend).' },
      { type: 'EXPENSES', name: 'Expense Report', description: 'JE expense totals with category, trend and largest-expense insights.' },
      { type: 'DAILY_POS', name: 'Daily Sales (POS)', description: 'Same data as POS Daily Sales — completed till sales for the day.' },
      { type: 'STOCK_MOVEMENTS', name: 'Stock Movement Report', description: 'Quantity movement from Inventory Management; JE inventory valuation alongside.' },
      { type: 'INVENTORY_LOSS', name: 'Inventory Loss Report', description: 'Stock-out / write-off movements from inventory records, reconciled to JE.' },
    ],
  },
  {
    name: 'Operations and Controls',
    reports: [
      { type: 'INVENTORY', name: 'Inventory Valuation', description: 'Inventory GL accounts with control reconciliation.' },
      { type: 'PAYROLL', name: 'Payroll Summary', description: 'Salaries (Account 5200) and payroll liabilities.' },
      { type: 'LOANS', name: 'Loan Summary', description: 'Loan liabilities and finance costs.' },
      { type: 'TAXES', name: 'Tax Reports', description: 'VAT, PAYE and tax accounts.' },
    ],
  },
];

/** Report types removed from this hub (still available elsewhere / via API if needed). */
export const HIDDEN_REPORT_TYPES = new Set([
  'TRIAL_BALANCE',
  'RECEIVABLES',
  'PAYABLES',
  'EQUITY_STATEMENT',
  'EQUITY',
  'BUDGET_VS_ACTUAL',
  'FIXED_ASSETS',
]);

export function findReportByType(type) {
  if (!type) return null;
  const upper = String(type).toUpperCase();
  if (HIDDEN_REPORT_TYPES.has(upper)) return null;
  for (const cat of REPORT_CATEGORIES) {
    const match = cat.reports.find((r) => r.type === upper);
    if (match) return match;
  }
  return Object.values(REPORT_TYPES).includes(upper) && !HIDDEN_REPORT_TYPES.has(upper)
    ? { type: upper, name: upper.replaceAll('_', ' '), description: '' }
    : null;
}

export function defaultReportSelection() {
  return REPORT_CATEGORIES[0].reports[0];
}

export function allReportLinks() {
  return REPORT_CATEGORIES.flatMap((cat) =>
    cat.reports.filter((r) => r.type !== REPORTS_DASHBOARD_TYPE).map((r) => ({ ...r, category: cat.name }))
  );
}
