/** @typedef {{ prefix: string, anyOf: string[] }} ApiRouteRule */

import { POS_SALES_PERMISSIONS } from './posPermissions';

/** Permissions granted to POS / sales workflows for shared catalog & tender APIs */
const POS_SALES = [...POS_SALES_PERMISSIONS];

function withPos(...permissions) {
  return [...new Set([...permissions, ...POS_SALES])];
}

/** @type {ApiRouteRule[]} */
const API_ROUTE_RULES = [
  { prefix: '/api/users', anyOf: ['users.view', 'users.create', 'users.update', 'users.delete'] },
  { prefix: '/api/roles', anyOf: ['roles.view', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign'] },
  { prefix: '/api/dashboard', anyOf: ['dashboard.view', 'reports.view'] },
  { prefix: '/api/reports/pos-daily', anyOf: withPos('reports.view', 'sales.export') },
  { prefix: '/api/reports', anyOf: ['reports.view'] },
  { prefix: '/api/clients', anyOf: withPos('clients.view', 'clients.create', 'clients.update', 'clients.delete') },
  { prefix: '/api/sales', anyOf: [...POS_SALES] },
  { prefix: '/api/pos', anyOf: [...POS_SALES] },
  { prefix: '/api/desktop', anyOf: ['sales.create', 'invoices.create', 'inventory.update', 'payments.create', 'clients.create'] },
  { prefix: '/api/quotations', anyOf: ['quotations.view', 'quotations.create', 'quotations.update', 'quotations.delete'] },
  { prefix: '/api/invoices', anyOf: ['invoices.view', 'invoices.create', 'invoices.update', 'invoices.delete'] },
  { prefix: '/api/expenses', anyOf: ['expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete'] },
  { prefix: '/api/payments', anyOf: ['payments.view', 'payments.create', 'payments.update', 'payments.delete'] },
  { prefix: '/api/stock', anyOf: withPos('inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete') },
  { prefix: '/api/inventory', anyOf: withPos('inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete') },
  { prefix: '/api/purchases', anyOf: ['purchases.view', 'purchases.create', 'purchases.update', 'purchases.delete'] },
  { prefix: '/api/suppliers', anyOf: ['suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete'] },
  { prefix: '/api/accounts', anyOf: withPos('accounts.view', 'accounts.create', 'accounts.update', 'accounts.delete') },
  { prefix: '/api/chart-of-accounts', anyOf: withPos('accounts.view', 'accounts.create', 'accounts.update', 'accounts.delete') },
  { prefix: '/api/general-ledger', anyOf: ['generalLedger.view'] },
  { prefix: '/api/journal-entries', anyOf: ['journalEntries.view', 'journalEntries.create', 'journalEntries.update', 'journalEntries.delete'] },
  { prefix: '/api/trial-balance', anyOf: ['trialBalance.view'] },
  { prefix: '/api/accounting', anyOf: ['accounting.view', 'accounts.view', 'journalEntries.view', 'generalLedger.view'] },
  { prefix: '/api/accounting-periods', anyOf: ['journalEntries.view', 'journalEntries.update'] },
  // Phase 15 — close middleware catalogue gap for V2 / module APIs (handlers still re-check permissions)
  { prefix: '/api/accounting-v2', anyOf: ['accounting.view', 'journalEntries.view', 'generalLedger.view', 'accounts.view'] },
  { prefix: '/api/coa-v2', anyOf: ['accounts.view', 'accounts.create', 'accounts.update'] },
  { prefix: '/api/bank-reconciliation', anyOf: ['bankReconciliation.view', 'bankReconciliation.approve', 'bankReconciliation.complete'] },
  { prefix: '/api/equity-management', anyOf: ['equity.view', 'accounting.view', 'accounts.view', 'reports.view'] },
  { prefix: '/api/accounting-close', anyOf: ['accountingClose.view', 'accountingClose.viewDashboard', 'accounting.view', 'journalEntries.view'] },
  { prefix: '/api/financial-planning', anyOf: ['financialPlanning.view', 'budgets.view', 'reports.view'] },
  { prefix: '/api/loan-readiness', anyOf: ['loanReadiness.view', 'reports.view', 'budgets.view'] },
  { prefix: '/api/security-governance', anyOf: ['securityGovernance.viewDashboard', 'securityGovernance.viewAudit', 'users.view', 'roles.view', 'system.view'] },
  { prefix: '/api/branches', anyOf: withPos('branches.view', 'branches.create', 'branches.update', 'branches.delete') },
  { prefix: '/api/hr-reports', anyOf: ['hr.view', 'reports.view'] },
  { prefix: '/api/employees', anyOf: ['hr.view', 'hr.create', 'hr.update', 'hr.delete'] },
  { prefix: '/api/attendance', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/leave', anyOf: ['leave.view', 'leave.create', 'leave.update', 'leave.delete'] },
  { prefix: '/api/leave-requests', anyOf: ['leave.view', 'leave.approve'] },
  // payroll-v2 must be listed separately: `/api/payroll` does not prefix-match `/api/payroll-v2`
  { prefix: '/api/payroll-v2', anyOf: ['payroll.view', 'payroll.create', 'payroll.update', 'payroll.process', 'hr.view'] },
  { prefix: '/api/payroll', anyOf: ['payroll.view', 'payroll.create', 'payroll.update', 'payroll.process', 'hr.view'] },
  { prefix: '/api/budgets', anyOf: ['budgets.view', 'budgets.create', 'budgets.update', 'budgets.delete'] },
  { prefix: '/api/budget-forecast', anyOf: ['budgets.view', 'budgets.create', 'budgets.update', 'budgets.delete', 'budgets.approve'] },
  { prefix: '/api/assets', anyOf: ['assets.view', 'assets.create', 'assets.update', 'assets.delete'] },
  { prefix: '/api/liabilities', anyOf: ['assets.view', 'assets.create', 'assets.update', 'assets.delete'] },
  { prefix: '/api/rentals', anyOf: ['rentals.view', 'rentals.create', 'rentals.update', 'rentals.delete'] },
  { prefix: '/api/tax-management', anyOf: withPos('tax.view', 'tax.update', 'taxManagement.view', 'taxManagement.update') },
  { prefix: '/api/tax', anyOf: withPos('tax.view', 'tax.update') },
  { prefix: '/api/tax-types', anyOf: withPos('tax.view', 'tax.update') },
  { prefix: '/api/tax-accounts', anyOf: withPos('tax.view', 'tax.update') },

  { prefix: '/api/analytics', anyOf: ['reports.view'] },
  { prefix: '/api/cogs', anyOf: ['reports.view', 'inventory.view'] },
  { prefix: '/api/bf', anyOf: ['budgets.view', 'budgets.create', 'budgets.update'] },
  { prefix: '/api/capital-account', anyOf: ['accounts.view', 'accounts.update', 'reports.view'] },
  { prefix: '/api/departments', anyOf: ['users.view', 'users.update', 'hr.view'] },
  { prefix: '/api/deductions', anyOf: ['payroll.view', 'payroll.update'] },
  { prefix: '/api/benefits', anyOf: ['payroll.view', 'payroll.update'] },
  { prefix: '/api/asset-categories', anyOf: ['assets.view', 'assets.update'] },
  { prefix: '/api/categories', anyOf: ['expenses.view', 'expenses.update'] },
  { prefix: '/api/currencies', anyOf: ['settings.view', 'settings.update', 'system.update'] },
  { prefix: '/api/credit-notes', anyOf: ['invoices.view', 'invoices.create', 'invoices.update'] },
  { prefix: '/api/debit-notes', anyOf: ['invoices.view', 'invoices.create', 'invoices.update'] },
  { prefix: '/api/attendance-policies', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/account', anyOf: ['system.view', 'settings.view'] },
  { prefix: '/api/data-export', anyOf: ['reports.export', 'users.export'] },
  { prefix: '/api/diagnostics', anyOf: ['system.view', 'settings.view'] },
  { prefix: '/api/ai-assistant', anyOf: ['reports.view', 'dashboard.view'] },
  { prefix: '/api/eis', anyOf: withPos('reports.view', 'invoices.view', 'inventory.view') },
  {
    prefix: '/api/mra-eis',
    anyOf: [
      'settings.view',
      'settings.update',
      'eis.availabilityView',
      'eis.participationEnable',
      'eis.businessSettingsManage',
      'eis.readinessView',
      'reports.view',
    ],
  },
  { prefix: '/api/exchange-rates', anyOf: ['settings.view', 'settings.update'] },
  { prefix: '/api/expense-categories', anyOf: ['expenses.view', 'expenses.update'] },
  { prefix: '/api/forecasts', anyOf: ['budgets.view', 'budgets.create', 'budgets.update'] },
  { prefix: '/api/gratuity', anyOf: ['payroll.view', 'payroll.update'] },
  { prefix: '/api/historical-expenses', anyOf: ['expenses.create', 'expenses.update'] },
  { prefix: '/api/historical-transactions', anyOf: ['invoices.create', 'sales.create', 'expenses.create'] },
  { prefix: '/api/invoice/templates', anyOf: ['invoices.view', 'invoices.update'] },
  { prefix: '/api/leave-balances', anyOf: ['leave.view', 'leave.update', 'hr.view'] },
  { prefix: '/api/leave-policies', anyOf: ['leave.view', 'leave.update', 'hr.update'] },
  { prefix: '/api/liability-categories', anyOf: ['assets.view', 'assets.update'] },
  { prefix: '/api/locations', anyOf: withPos('inventory.view', 'inventory.update') },
  { prefix: '/api/partial-payment', anyOf: ['payments.create', 'invoices.update', 'expenses.update'] },
  { prefix: '/api/payables', anyOf: ['expenses.view', 'reports.view'] },
  { prefix: '/api/payment-accounts', anyOf: withPos('payments.view', 'payments.create', 'payments.update') },
  { prefix: '/api/payment-methods', anyOf: withPos('payments.view', 'payments.update') },
  { prefix: '/api/pension', anyOf: ['payroll.view', 'payroll.update'] },
  { prefix: '/api/performance', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/performance-feedback', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/performance-goals', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/performance-reviews', anyOf: ['hr.view', 'hr.update'] },
  { prefix: '/api/premium', anyOf: ['system.view', 'settings.view'] },
  { prefix: '/api/products', anyOf: withPos('inventory.view', 'inventory.update') },
  { prefix: '/api/receivables', anyOf: ['invoices.view', 'reports.view'] },
  { prefix: '/api/services', anyOf: withPos('inventory.view', 'inventory.update') },
  { prefix: '/api/units', anyOf: ['inventory.view', 'inventory.update'] },
  { prefix: '/api/fix-logo', anyOf: ['system.update'] },
  { prefix: '/api/direct-fix-logo', anyOf: ['system.update'] },
  { prefix: '/api/force-fix-logo', anyOf: ['system.update'] },
  { prefix: '/api/manual-fix-logo', anyOf: ['system.update'] },
  { prefix: '/api/invoice/templates', anyOf: ['invoices.view', 'invoices.update'] },
  { prefix: '/api/profile', anyOf: ['system.view', 'users.update', 'users.view'] },
  { prefix: '/api/recurring-expenses', anyOf: ['expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete'] },
  { prefix: '/api/rental-assets', anyOf: ['rentals.view', 'rentals.create', 'rentals.update', 'rentals.delete'] },
  { prefix: '/api/salary-advances', anyOf: ['payroll.view', 'payroll.create', 'payroll.update'] },
  // Business setup wizard — must be listed or api-guard denies with reason=no_rule
  { prefix: '/api/setup', anyOf: ['settings.view', 'settings.update', 'system.view', 'system.update'] },
  { prefix: '/api/settings/tax-configurations', anyOf: withPos('tax.view', 'tax.update', 'settings.view', 'settings.update') },
  { prefix: '/api/settings/tax', anyOf: withPos('tax.view', 'tax.update', 'settings.update') },
  { prefix: '/api/settings/tax-defaults', anyOf: withPos('tax.view', 'tax.update', 'settings.view', 'settings.update') },
  { prefix: '/api/stock-by-business', anyOf: withPos('inventory.view') },
  { prefix: '/api/stock-by-branch', anyOf: withPos('inventory.view') }, // legacy alias — no branch UI

  { prefix: '/api/stock-transfers', anyOf: ['inventory.view', 'inventory.update'] },
  { prefix: '/api/tenant', anyOf: withPos('system.view', 'system.update', 'system.switchTenant') },
  { prefix: '/api/transactions/reversals', anyOf: ['journalEntries.view'] },
  { prefix: '/api/transactions/reverse', anyOf: ['journalEntries.update'] },
  { prefix: '/api/uploads', anyOf: withPos('system.view', 'users.view', 'settings.view', 'dashboard.view') },
];

const SORTED = [...API_ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

const API_PUBLIC_PREFIXES = [
  '/api/auth',
  '/api/admin',
  '/api/subscription',
  '/api/affiliate',
  '/api/contact',
  '/api/mobile-app',
  '/api/cron',
  '/api/debug',
  '/api/test',
  '/api/placeholder',
  // Phase 17 — infra probes (no session); deep diagnostics still token-gated
  '/api/system/health',
  // Phase 18 — cutover status (read-only; activation requires ops env + admin)
  '/api/system/cutover',
];

export function isApiPublicPath(pathname) {
  return API_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getApiRuleForPath(pathname) {
  if (!pathname || pathname[0] !== '/') return null;
  for (const rule of SORTED) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule;
    }
  }
  return null;
}

