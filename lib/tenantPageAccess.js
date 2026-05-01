/**
 * Maps tenant app URL prefixes to permissions required to open that area in the browser.
 * Used by `/api/auth/page-guard` + middleware. Longer prefixes are matched first.
 *
 * Paths with no matching rule are allowed for any authenticated subscriber (backward compatible).
 */

/** @typedef {{ prefix: string, anyOf?: string[], allOf?: string[] }} RouteRule */

/** @type {RouteRule[]} */
const ROUTE_RULES = [
  { prefix: '/transactions/reversals', anyOf: ['journalEntries.view'] },
  { prefix: '/journal-entries', anyOf: ['journalEntries.view'] },
  { prefix: '/accounting-periods', anyOf: ['journalEntries.view'] },
  { prefix: '/accounting/receivables', anyOf: ['invoices.view'] },
  { prefix: '/accounting/payables', anyOf: ['expenses.view'] },
  { prefix: '/accounting', anyOf: ['accounting.view', 'accounts.view', 'journalEntries.view', 'generalLedger.view'] },
  { prefix: '/chart-of-accounts', anyOf: ['accounts.view'] },
  { prefix: '/general-ledger', anyOf: ['generalLedger.view'] },
  { prefix: '/trial-balance', anyOf: ['trialBalance.view'] },
  { prefix: '/capital-account', anyOf: ['reports.view', 'accounts.view'] },
  { prefix: '/credit-debit-notes', anyOf: ['invoices.view'] },
  { prefix: '/quotations', anyOf: ['quotations.view', 'invoices.view'] },
  { prefix: '/invoice', anyOf: ['invoices.view'] },
  { prefix: '/expenses', anyOf: ['expenses.view'] },
  { prefix: '/payments', anyOf: ['payments.view'] },
  { prefix: '/reports', anyOf: ['reports.view'] },
  { prefix: '/clients', anyOf: ['clients.view'] },
  { prefix: '/stock', anyOf: ['inventory.view', 'stock.view'] },
  { prefix: '/purchases', anyOf: ['purchases.view', 'suppliers.view', 'inventory.view', 'stock.view'] },
  { prefix: '/suppliers', anyOf: ['suppliers.view', 'inventory.view', 'stock.view'] },
  { prefix: '/hr/leave', anyOf: ['leave.view', 'leave.create', 'hr.view'] },
  { prefix: '/hr', anyOf: ['hr.view'] },
  { prefix: '/payroll', anyOf: ['payroll.view', 'hr.view'] },
  { prefix: '/budget-forecast', anyOf: ['budgets.view'] },
  { prefix: '/budget', anyOf: ['budgets.view'] },
  { prefix: '/asset-management', anyOf: ['assets.view'] },
  { prefix: '/liability-management', anyOf: ['assets.view', 'accounts.view'] },
  { prefix: '/rentals', anyOf: ['rentals.view', 'invoices.view'] },
  { prefix: '/tax-types', anyOf: ['tax.view', 'accounting.view', 'reports.view'] },
  { prefix: '/tax-management', anyOf: ['tax.view', 'accounting.view'] },
  { prefix: '/tax-rules', anyOf: ['tax.view'] },
  { prefix: '/tax-accounts', anyOf: ['tax.view', 'accounts.view'] },
  { prefix: '/tax', anyOf: ['tax.view'] },
  { prefix: '/eis', anyOf: ['reports.view', 'invoices.view'] },
  { prefix: '/branches', anyOf: ['branches.view', 'users.view', 'system.view'] },
  { prefix: '/financial-setup', anyOf: ['accounts.view', 'journalEntries.view', 'system.view'] },
  { prefix: '/cogs', anyOf: ['reports.view', 'inventory.view', 'stock.view'] },
  { prefix: '/customization', anyOf: ['system.view'] },
  { prefix: '/settings', anyOf: ['system.view', 'settings.view'] },
  { prefix: '/users', anyOf: ['users.view', 'roles.view'] },
  { prefix: '/dashboard', anyOf: ['dashboard.view'] },
  { prefix: '/pos', anyOf: ['sales.view'] },
];

const SORTED = [...ROUTE_RULES].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * @param {string} pathname
 * @returns {RouteRule | null}
 */
export function getRouteRuleForPath(pathname) {
  if (!pathname || pathname[0] !== '/') return null;
  const path = pathname.split('?')[0];
  for (const rule of SORTED) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule;
    }
  }
  return null;
}
