/** Client-safe MRA EIS tenant navigation config (no Prisma). */

export const TENANT_EIS_NAV_LOCKED = Object.freeze([
  { href: '/settings/integrations/mra-eis/centre', text: 'Overview', icon: 'dashboard' },
  { href: '/settings/integrations/mra-eis', text: 'Controls Hub', icon: 'settings' },
]);

export const TENANT_EIS_NAV_FULL = Object.freeze([
  { href: '/settings/integrations/mra-eis/centre', text: 'Overview', icon: 'dashboard' },
  { href: '/settings/integrations/mra-eis', text: 'Controls Hub', icon: 'settings' },
  { href: '/settings/integrations/mra-eis/terminals', text: 'Terminals', icon: 'pos' },
  { href: '/settings/integrations/mra-eis/mappings', text: 'Mappings', icon: 'coa' },
  { href: '/settings/integrations/mra-eis/catalogue', text: 'Catalogue', icon: 'stock' },
  { href: '/settings/integrations/mra-eis/sales-bridge', text: 'Sales Bridge', icon: 'taxTransactions' },
  { href: '/settings/integrations/mra-eis/sales-transmission', text: 'Transmission', icon: 'importExport' },
  { href: '/settings/integrations/mra-eis/fiscal-snapshots', text: 'Snapshots', icon: 'reports' },
  { href: '/settings/integrations/mra-eis/fiscal-receipts', text: 'Receipts', icon: 'receipts' },
  { href: '/settings/integrations/mra-eis/reconciliation', text: 'Reconciliation', icon: 'taxReconciliation' },
  { href: '/settings/integrations/mra-eis/offline', text: 'Offline', icon: 'stock' },
  { href: '/settings/integrations/mra-eis/restrictions', text: 'Restrictions', icon: 'settings' },
  { href: '/settings/integrations/mra-eis/migration', text: 'Data Migration', icon: 'importExport' },
  { href: '/settings/integrations/mra-eis/phase21', text: 'Certification & Rollout', icon: 'fileCheck' },
]);

export function buildTenantEisNavMenuItem(navItems) {
  return {
    href: '/settings/integrations/mra-eis/centre',
    icon: 'reports',
    text: 'MRA EIS Centre',
    expandable: true,
    subItems: Array.isArray(navItems) && navItems.length ? navItems : [...TENANT_EIS_NAV_LOCKED],
  };
}
