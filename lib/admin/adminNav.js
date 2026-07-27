/**
 * Platform admin navigation (System Administration control plane).
 * No System Chart of Accounts — removed from control plane UI.
 */

export const ADMIN_NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/insightbooks/dashboard', text: 'Dashboard', icon: 'LayoutDashboard' },
      { href: '/insightbooks/reports', text: 'Reports', icon: 'BarChart3' },
      { href: '/insightbooks/imports', text: 'Imports (dry-run)', icon: 'Upload' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform Management',
    items: [
      { href: '/insightbooks/tenant-management', text: 'Tenant Management', icon: 'Building2' },
      { href: '/insightbooks/user-management', text: 'User Management', icon: 'Users' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    items: [
      { href: '/insightbooks/global-settings', text: 'Global Settings', icon: 'Settings' },
      {
        href: '/insightbooks/feature-entitlements',
        text: 'Feature Entitlements',
        icon: 'ToggleLeft',
      },
    ],
  },
  {
    id: 'apps',
    label: 'Applications and Partners',
    items: [
      { href: '/insightbooks/mobile-app', text: 'Android App', icon: 'Smartphone' },
      {
        href: '/insightbooks/affiliate',
        text: 'Affiliate Management',
        icon: 'Handshake',
        expandable: true,
        subItems: [
          { href: '/insightbooks/affiliate', text: 'Affiliates' },
          { href: '/insightbooks/affiliate/commissions', text: 'Commissions' },
          { href: '/insightbooks/affiliate/payouts', text: 'Payouts' },
        ],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing and Revenue',
    items: [
      {
        href: '/insightbooks/billing',
        text: 'Billing',
        icon: 'CreditCard',
        expandable: true,
        subItems: [
          { href: '/insightbooks/billing/overview', text: 'Billing Overview' },
          { href: '/insightbooks/billing/plans', text: 'Plans' },
          { href: '/insightbooks/billing/subscriptions', text: 'Subscriptions' },
          { href: '/insightbooks/billing/invoices', text: 'Invoices' },
          { href: '/insightbooks/billing/payments', text: 'Payments' },
          { href: '/insightbooks/billing/credits', text: 'Credits & Refunds' },
          { href: '/insightbooks/billing/reconciliation', text: 'Reconciliation' },
        ],
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      {
        href: '/insightbooks/email-management',
        text: 'Email Management',
        icon: 'Mail',
        expandable: true,
        subItems: [
          { href: '/insightbooks/email-management', text: 'Send & history' },
          { href: '/insightbooks/email-management/templates', text: 'Templates' },
          { href: '/insightbooks/email-management/suppression', text: 'Suppression' },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [
      { href: '/insightbooks/mra-eis', text: 'MRA EIS Entitlement', icon: 'FileCheck' },
    ],
  },
  {
    id: 'security',
    label: 'Security and Operations',
    items: [
      {
        href: '/insightbooks/audit',
        text: 'Audit & Security',
        icon: 'Shield',
        expandable: true,
        subItems: [
          { href: '/insightbooks/audit', text: 'Audit log' },
          { href: '/insightbooks/security', text: 'Security overview' },
          { href: '/insightbooks/security/monitoring', text: 'Monitoring' },
          { href: '/insightbooks/security/compliance', text: 'Compliance signals' },
        ],
      },
      { href: '/insightbooks/system-health', text: 'System Health', icon: 'Activity' },
    ],
  },
];

/** Paths that must never appear in admin navigation. */
export const REMOVED_ADMIN_ROUTES = ['/insightbooks/chart-of-accounts'];

export function isRemovedAdminRoute(pathname) {
  if (!pathname) return false;
  return REMOVED_ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function adminNavContainsCoa() {
  return ADMIN_NAV_SECTIONS.some((section) =>
    section.items.some(
      (item) =>
        item.href === '/insightbooks/chart-of-accounts' ||
        item.text?.toLowerCase().includes('chart of accounts') ||
        item.subItems?.some((s) => s.href === '/insightbooks/chart-of-accounts')
    )
  );
}
