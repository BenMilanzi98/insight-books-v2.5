const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const mods = [
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
  { file: 'app/dashboard/page.js', titleKey: 'dashboard.title' },
  { file: 'app/rentals/page.js', titleKey: 'rental-hiring.title' },
];

let ok = 0;
for (const m of mods) {
  const full = path.join(root, m.file);
  if (!fs.existsSync(full)) {
    console.log('missing', m.file);
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  if (src.includes('UseTranslatedDocumentTitle')) {
    console.log('skip', m.file);
    ok++;
    continue;
  }
  if (!src.includes('use client') && !src.includes('"use client"')) {
    console.log('skip-not-client', m.file);
    continue;
  }
  const importLine =
    "import UseTranslatedDocumentTitle from '@/components/i18n/UseTranslatedDocumentTitle';\n";
  src = src.replace(/(['"]use client['"];?\r?\n)/, `$1${importLine}`);
  const marker = `<UseTranslatedDocumentTitle titleKey="${m.titleKey}" />`;
  src = src.replace(/return\s*\(\s*\r?\n/, (match) => `${match}      ${marker}\n`);
  fs.writeFileSync(full, src);
  console.log('wired', m.file);
  ok++;
}
console.log('done', ok);
