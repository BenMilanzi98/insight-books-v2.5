/** Client-safe MRA EIS tenant navigation config (no Prisma). */

export const TENANT_EIS_NAV_LOCKED = Object.freeze([
  { href: '/settings/integrations/mra-eis/centre', text: 'Overview' },
  { href: '/settings/integrations/mra-eis', text: 'Controls Hub' },
]);

export const TENANT_EIS_NAV_FULL = Object.freeze([
  { href: '/settings/integrations/mra-eis/centre', text: 'Overview' },
  { href: '/settings/integrations/mra-eis', text: 'Controls Hub' },
  { href: '/settings/integrations/mra-eis/terminals', text: 'Terminals' },
  { href: '/settings/integrations/mra-eis/mappings', text: 'Mappings' },
  { href: '/settings/integrations/mra-eis/catalogue', text: 'Catalogue' },
  { href: '/settings/integrations/mra-eis/sales-bridge', text: 'Sales Bridge' },
  { href: '/settings/integrations/mra-eis/sales-transmission', text: 'Transmission' },
  { href: '/settings/integrations/mra-eis/fiscal-snapshots', text: 'Snapshots' },
  { href: '/settings/integrations/mra-eis/fiscal-receipts', text: 'Receipts' },
  { href: '/settings/integrations/mra-eis/reconciliation', text: 'Reconciliation' },
  { href: '/settings/integrations/mra-eis/offline', text: 'Offline' },
  { href: '/settings/integrations/mra-eis/restrictions', text: 'Restrictions' },
  { href: '/settings/integrations/mra-eis/migration', text: 'Data Migration' },
  { href: '/settings/integrations/mra-eis/phase21', text: 'Certification & Rollout' },
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
