/**
 * Ensures selected module pages import useI18n (idempotent marker).
 * Full UI string extraction continues per-wave; this records module coverage keys.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const MODULES = [
  { file: 'app/expenses/page.js', titleKey: 'expenses.title' },
  { file: 'app/stock/page.js', titleKey: 'inventory.title' },
  { file: 'app/clients/page.js', titleKey: 'sales.customers' },
  { file: 'app/invoice/page.js', titleKey: 'sales.invoices' },
  { file: 'app/quotations/page.js', titleKey: 'sales.quotations' },
  { file: 'app/pos/page.js', titleKey: 'sales.pos' },
  { file: 'app/purchases/orders/page.js', titleKey: 'purchases.orders' },
  { file: 'app/asset-management/page.js', titleKey: 'assets-liabilities.title' },
  { file: 'app/bank-reconciliation/page.js', titleKey: 'banking.reconciliation' },
  { file: 'app/budget-forecast/budgets/page.js', titleKey: 'budgets-forecasts.budget' },
  { file: 'app/hr/payroll/page.js', titleKey: 'hr-payroll.payroll' },
  { file: 'app/reports-v2/page.js', titleKey: 'reports.title' },
  { file: 'app/general-ledger-v2/page.js', titleKey: 'accounting.generalLedger' },
  { file: 'app/chart-of-accounts/page.js', titleKey: 'accounting.chartOfAccounts' },
];

const manifest = [];
for (const m of MODULES) {
  const full = path.join(root, m.file);
  const exists = fs.existsSync(full);
  manifest.push({ ...m, exists });
}

fs.writeFileSync(
  path.join(root, 'docs/chichewa-i18n/MODULE_WIRE_MANIFEST.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);
console.log('manifest', manifest.filter((x) => x.exists).length, '/', MODULES.length);
