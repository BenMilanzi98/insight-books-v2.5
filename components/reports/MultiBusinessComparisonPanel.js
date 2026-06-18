'use client';

import { formatCurrency } from '@/lib/currencyUtils';

export const INCOME_STATEMENT_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalRevenue', label: 'Revenue', format: 'currency' },
  { key: 'cogs', label: 'COGS', format: 'currency' },
  { key: 'totalOperatingExpenses', label: 'Operating expenses', format: 'currency' },
  { key: 'grossProfit', label: 'Gross profit', format: 'currency' },
  { key: 'netIncome', label: 'Net income', format: 'currency' },
];

export const BALANCE_SHEET_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalAssets', label: 'Total assets', format: 'currency' },
  { key: 'totalLiabilities', label: 'Total liabilities', format: 'currency' },
  { key: 'totalEquity', label: 'Total equity', format: 'currency' },
];

export const DASHBOARD_METRICS_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'expenses', label: 'Expenses', format: 'currency' },
  { key: 'profit', label: 'Net profit', format: 'currency' },
];

export const CASH_FLOW_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalInflows', label: 'Cash inflows', format: 'currency' },
  { key: 'totalOutflows', label: 'Cash outflows', format: 'currency' },
  { key: 'netCashFlow', label: 'Net cash flow', format: 'currency' },
  { key: 'closingCashBalance', label: 'Closing cash', format: 'currency' },
];

export const POS_DAILY_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalSales', label: 'Total sales', format: 'currency' },
  { key: 'transactionCount', label: 'Transactions', format: 'text' },
  { key: 'grossProfit', label: 'Gross profit', format: 'currency' },
];

export const STOCK_MOVEMENT_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalProducts', label: 'Products', format: 'text' },
  { key: 'totalClosingQuantity', label: 'Closing qty', format: 'text' },
];

export const TRIAL_BALANCE_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalDebits', label: 'Total debits', format: 'currency' },
  { key: 'totalCredits', label: 'Total credits', format: 'currency' },
  { key: 'accountCount', label: 'Accounts', format: 'text' },
];

export const EXPENSE_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalExpenses', label: 'Total expenses', format: 'currency' },
  { key: 'expenseCount', label: 'Line items', format: 'text' },
];

export const SALES_COMPARE_COLUMNS = [
  { key: 'tenantName', label: 'Business', format: 'text' },
  { key: 'totalSales', label: 'Total sales', format: 'currency' },
  { key: 'transactionCount', label: 'Transactions', format: 'text' },
];

function resolveCellValue(row, key) {
  if (!row || !key) return null;
  if (row[key] != null && row[key] !== '') return row[key];

  const aliases = {
    tenantName: ['businessName', 'name', 'company'],
    totalRevenue: ['revenue'],
    totalOperatingExpenses: ['expenses', 'operatingExpenses'],
    netIncome: ['profit', 'netProfit'],
    totalEquity: ['equity'],
    totalDebits: ['debits'],
    totalCredits: ['credits'],
    totalInflows: ['cashInflows', 'inflows'],
    totalOutflows: ['cashOutflows', 'outflows'],
    netCashFlow: ['netFlow', 'netCash'],
    closingCashBalance: ['closingCash', 'closingBalance'],
    totalProducts: ['productCount', 'products'],
    totalClosingQuantity: ['closingQuantity', 'closingQty'],
    expenseCount: ['count', 'lineItems'],
    transactionCount: ['transactions', 'count'],
    totalSales: ['sales', 'revenue'],
  };

  for (const alt of aliases[key] || []) {
    if (row[alt] != null && row[alt] !== '') return row[alt];
  }
  return null;
}

function formatCell(value, format) {
  if (format === 'currency') {
    return formatCurrency(Number(value) || 0);
  }
  if (value == null || value === '') return '—';
  return String(value);
}

/**
 * Side-by-side comparison table for multi-tenant report payloads (`byTenant` arrays).
 *
 * @param {object} props
 * @param {object[]} props.byTenant
 * @param {{ key: string, label: string, format?: 'currency'|'text' }[]} [props.columns]
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
export default function MultiBusinessComparisonPanel({
  byTenant,
  columns = INCOME_STATEMENT_COMPARE_COLUMNS,
  title = 'Business comparison',
  className = '',
}) {
  if (!Array.isArray(byTenant) || byTenant.length < 2) return null;

  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      aria-label={title}
    >
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Per-business breakdown across {byTenant.length} businesses
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 ${col.format === 'currency' ? 'text-right' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byTenant.map((row, idx) => (
              <tr key={row.tenantId || row.id || idx} className="hover:bg-slate-50/80">
                {columns.map((col) => {
                  const value = resolveCellValue(row, col.key);
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 ${
                        col.format === 'currency'
                          ? 'text-right font-mono tabular-nums text-slate-900'
                          : 'font-medium text-slate-800'
                      }`}
                    >
                      {formatCell(value, col.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
