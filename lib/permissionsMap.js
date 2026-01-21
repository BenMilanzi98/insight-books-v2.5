// lib/permissionsMap.js
export const permissionModules = {
    dashboard:{actions:['view']},
    users: { actions: ['create', 'view', 'update', 'delete', 'export'] },
    roles: { actions: ['create', 'view', 'update', 'delete', 'assign'] },
    system: { actions: ['view', 'update'] },
    clients: { actions: ['create', 'view', 'update', 'delete', 'export'] },
    sales: { actions: ['create', 'view', 'update', 'delete', 'void', 'refund', 'export'] },
    quotations: { actions: ['create', 'view', 'update', 'delete', 'convert', 'approve', 'export'] },
    invoices: { actions: ['create', 'view', 'update', 'delete', 'send', 'markAsPaid', 'export'] },
    expenses: { actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
    payments: { actions: ['create', 'view', 'update', 'delete', 'export'] },
    budgets: { actions: ['create', 'view', 'update', 'delete', 'approve', 'export'] },
    branches: { actions: ['create', 'view', 'update', 'delete'] },
    reports: { actions: ['view', 'export'] },
    inventory: { actions: ['create', 'view', 'update', 'delete', 'adjust', 'export'] },
    hr: { actions: ['create', 'view', 'update', 'delete', 'export'] },
    payroll: { actions: ['create', 'view', 'update', 'delete', 'process', 'export'] },
    tax: { actions: ['view', 'update', 'export', 'settle'] },
    generalLedger: { actions: ['view', 'export'] },
    journalEntries: { actions: ['create', 'view', 'update', 'delete', 'post', 'export'] },
    accounts: { actions: ['create', 'view', 'update', 'delete', 'export'] },
    trialBalance: { actions: ['view', 'export'] },
    assets: { actions: ['create', 'view', 'update', 'delete', 'export'] }
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
    