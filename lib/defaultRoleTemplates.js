import { permissionModules, generateFullPermissions } from './permissionsMap.js';

function allFalseNestedPermissions() {
  const perms = {};
  for (const [module, { actions }] of Object.entries(permissionModules)) {
    perms[module] = {};
    for (const action of actions) perms[module][action] = false;
  }
  return perms;
}

function pick(perms, allowList = []) {
  const out = allFalseNestedPermissions();
  for (const key of allowList) {
    const [module, action] = String(key).split('.');
    if (out[module] && action in out[module]) out[module][action] = true;
  }
  return out;
}

/**
 * Default role templates per tenant.
 * These are intended as starting points and are editable via the Roles UI (Owner has roles.*).
 */
export function getDefaultRoleTemplates() {
  const owner = {
    name: 'Owner',
    description: 'Full access to all business features (can manage users & roles).',
    permissions: generateFullPermissions(),
  };

  const manager = {
    name: 'Manager',
    description: 'Operational manager access across sales, inventory, accounting and reports.',
    permissions: pick(null, [
      'dashboard.view',
      'clients.create', 'clients.view', 'clients.update', 'clients.delete', 'clients.export',
      'sales.create', 'sales.view', 'sales.update', 'sales.void', 'sales.refund', 'sales.export',
      'quotations.create', 'quotations.view', 'quotations.update', 'quotations.delete', 'quotations.convert', 'quotations.approve', 'quotations.export',
      'invoices.create', 'invoices.view', 'invoices.update', 'invoices.delete', 'invoices.send', 'invoices.markAsPaid', 'invoices.export',
      'expenses.create', 'expenses.view', 'expenses.update', 'expenses.delete', 'expenses.approve', 'expenses.export',
      'payments.create', 'payments.view', 'payments.update', 'payments.delete', 'payments.export',
      'inventory.create', 'inventory.view', 'inventory.update', 'inventory.delete', 'inventory.adjust', 'inventory.export',
      'budgets.create', 'budgets.view', 'budgets.update', 'budgets.delete', 'budgets.approve', 'budgets.export',
      'reports.view', 'reports.export',
      'tax.view', 'tax.update', 'tax.export', 'tax.settle',
      'accounts.view', 'accounts.export',
      'journalEntries.view', 'journalEntries.export',
      'generalLedger.view', 'generalLedger.export',
      'trialBalance.view', 'trialBalance.export',
      'assets.view', 'assets.export',
      'rentals.create', 'rentals.view', 'rentals.update', 'rentals.delete', 'rentals.export',
    ]),
  };

  const sales = {
    name: 'Sales',
    description: 'POS + customer-facing sales workflows (no accounting setup/admin).',
    permissions: pick(null, [
      'dashboard.view',
      'clients.create', 'clients.view', 'clients.update',
      'sales.create', 'sales.view', 'sales.void', 'sales.refund',
      'quotations.create', 'quotations.view',
      'invoices.create', 'invoices.view', 'invoices.send',
      'payments.create', 'payments.view',
      'inventory.view',
      'rentals.view', 'rentals.create', 'rentals.update',
    ]),
  };

  const inventory = {
    name: 'Inventory',
    description: 'Stock management and adjustments (no financial reporting).',
    permissions: pick(null, [
      'dashboard.view',
      'inventory.create', 'inventory.view', 'inventory.update', 'inventory.delete', 'inventory.adjust', 'inventory.export',
    ]),
  };

  const accountant = {
    name: 'Accountant',
    description: 'Accounting & reporting access (journals/COA/GL/trial balance, invoices/expenses read).',
    permissions: pick(null, [
      'dashboard.view',
      'invoices.view', 'invoices.export',
      'rentals.view', 'rentals.export',
      'expenses.view', 'expenses.export',
      'payments.view', 'payments.export',
      'reports.view', 'reports.export',
      'accounts.create', 'accounts.view', 'accounts.update', 'accounts.export',
      'journalEntries.create', 'journalEntries.view', 'journalEntries.update', 'journalEntries.delete', 'journalEntries.post', 'journalEntries.export',
      'generalLedger.view', 'generalLedger.export',
      'trialBalance.view', 'trialBalance.export',
      'tax.view', 'tax.update', 'tax.export', 'tax.settle',
    ]),
  };

  const reportsOnly = {
    name: 'ReportsOnly',
    description: 'Read-only reporting and exports.',
    permissions: pick(null, [
      'dashboard.view',
      'reports.view', 'reports.export',
      'generalLedger.view', 'generalLedger.export',
      'trialBalance.view', 'trialBalance.export',
      'tax.view', 'tax.export',
      'invoices.view', 'invoices.export',
      'expenses.view', 'expenses.export',
      'payments.view', 'payments.export',
    ]),
  };

  return [owner, manager, sales, inventory, accountant, reportsOnly];
}

