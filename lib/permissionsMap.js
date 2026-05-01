// lib/permissionsMap.js
// Single source of truth for RBAC modules/actions + UI labels (Roles & Permissions in /users).

export const permissionModules = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  users: { label: 'User Management', actions: ['create', 'view', 'update', 'delete', 'export'] },
  roles: { label: 'Role Management', actions: ['create', 'view', 'update', 'delete', 'assign'] },
  system: { label: 'System / Tenant', actions: ['view', 'update', 'switchTenant'] },
  settings: { label: 'Settings', actions: ['view', 'update'] },
  clients: { label: 'Client Management', actions: ['create', 'view', 'update', 'delete', 'export'] },
  sales: { label: 'POS', actions: ['create', 'view', 'update', 'delete', 'void', 'refund', 'export'] },
  quotations: { label: 'Quotations', actions: ['create', 'view', 'update', 'delete', 'convert', 'approve', 'export'] },
  invoices: { label: 'Invoicing', actions: ['create', 'view', 'update', 'delete', 'send', 'markAsPaid', 'export'] },
  expenses: { label: 'Expense Tracking', actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
  payments: { label: 'Payment Accounts', actions: ['create', 'view', 'update', 'delete', 'export'] },
  budgets: { label: 'Budget & Forecast', actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
  branches: { label: 'Branches', actions: ['create', 'view', 'update', 'delete'] },
  reports: { label: 'Financial Reporting', actions: ['view', 'export'] },
  inventory: { label: 'Stock / Inventory', actions: ['create', 'view', 'update', 'delete', 'adjust', 'export'] },
  purchases: { label: 'Purchases & Procurement', actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
  suppliers: { label: 'Suppliers', actions: ['create', 'view', 'update', 'delete', 'export'] },
  hr: { label: 'HR Management', actions: ['create', 'view', 'update', 'delete', 'export'] },
  payroll: { label: 'Payroll', actions: ['create', 'view', 'update', 'delete', 'process', 'export'] },
  leave: { label: 'Leave Management', actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
  tax: { label: 'Tax Management', actions: ['view', 'update', 'export', 'settle'] },
  generalLedger: { label: 'General Ledger', actions: ['view', 'export'] },
  journalEntries: { label: 'Journal Entries', actions: ['create', 'view', 'update', 'delete', 'post', 'export'] },
  accounts: { label: 'Chart of Accounts', actions: ['create', 'view', 'update', 'delete', 'export'] },
  trialBalance: { label: 'Trial Balance', actions: ['view', 'export'] },
  assets: { label: 'Fixed Assets', actions: ['create', 'view', 'update', 'delete', 'export'] },
  rentals: {
    label: 'Rentals & Hiring',
    actions: ['create', 'view', 'update', 'delete', 'export'],
  },
  accounting: { label: 'Accounting Hub', actions: ['view', 'manage', 'export'] },
};

export function generateFullPermissions() {
  const permissions = {};
  for (const [module, { actions }] of Object.entries(permissionModules)) {
    permissions[module] = {};
    for (const action of actions) {
      permissions[module][action] = true;
    }
  }
  return permissions;
}
