/**
 * Platform admin navigation (System Administration control plane).
 * No System Chart of Accounts — removed from control plane UI.
 */

import { CRM_NAV_ITEM } from '@/lib/admin/crmNav';

export const ADMIN_NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    labelKey: 'admin-shell.nav.sections.overview',
    items: [
      {
        href: '/insightbooks/dashboard',
        text: 'Dashboard',
        textKey: 'admin-shell.nav.items.dashboard',
        icon: 'LayoutDashboard',
      },
      {
        href: '/insightbooks/intelligence/executive',
        text: 'Intelligence',
        textKey: 'admin-shell.nav.items.intelligence',
        icon: 'LineChart',
      },
      {
        href: '/insightbooks/intelligence/revenue/overview',
        text: 'Revenue',
        textKey: 'admin-shell.nav.items.revenue',
        icon: 'CircleDollarSign',
      },
      {
        href: '/insightbooks/intelligence/customers/overview',
        text: 'Customers',
        textKey: 'admin-shell.nav.items.customers',
        icon: 'ContactRound',
      },
      {
        href: '/insightbooks/intelligence/customer-health/overview',
        text: 'Customer Health',
        textKey: 'admin-shell.nav.items.customerHealth',
        icon: 'HeartPulse',
      },
      {
        href: '/insightbooks/intelligence/product-analytics/overview',
        text: 'Product Analytics',
        textKey: 'admin-shell.nav.items.productAnalytics',
        icon: 'Boxes',
      },
      {
        href: '/insightbooks/customer-success/command-centre',
        text: 'Customer Success',
        textKey: 'admin-shell.nav.items.customerSuccess',
        icon: 'Headset',
      },
      {
        href: '/insightbooks/support',
        text: 'Support',
        textKey: 'admin-shell.nav.items.support',
        icon: 'LifeBuoy',
      },
      { ...CRM_NAV_ITEM },
      {
        href: '/insightbooks/reports',
        text: 'Reports',
        textKey: 'admin-shell.nav.items.reports',
        icon: 'BarChart3',
      },
      {
        href: '/insightbooks/imports',
        text: 'Imports (dry-run)',
        textKey: 'admin-shell.nav.items.imports',
        icon: 'Upload',
      },
    ],
  },
  {
    id: 'platform',
    label: 'Platform Management',
    labelKey: 'admin-shell.nav.sections.platform',
    items: [
      {
        href: '/insightbooks/tenant-management',
        text: 'Tenant Management',
        textKey: 'admin-shell.nav.items.tenants',
        icon: 'Building2',
      },
      {
        href: '/insightbooks/tenant-identity-transfer',
        text: 'Tenant Identity Transfer',
        textKey: 'admin-shell.nav.items.tenantIdentity',
        icon: 'Package',
      },
      {
        href: '/insightbooks/user-management',
        text: 'User Management',
        textKey: 'admin-shell.nav.items.users',
        icon: 'Users',
      },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    labelKey: 'admin-shell.nav.sections.configuration',
    items: [
      {
        href: '/insightbooks/global-settings',
        text: 'Global Settings',
        textKey: 'admin-shell.nav.items.settings',
        icon: 'Settings',
      },
      {
        href: '/insightbooks/feature-entitlements',
        text: 'Feature Entitlements',
        textKey: 'admin-shell.nav.items.features',
        icon: 'ToggleLeft',
      },
    ],
  },
  {
    id: 'apps',
    label: 'Applications and Partners',
    labelKey: 'admin-shell.nav.sections.apps',
    items: [
      {
        href: '/insightbooks/mobile-app',
        text: 'Android App',
        textKey: 'admin-shell.nav.items.mobile',
        icon: 'Smartphone',
      },
      {
        href: '/insightbooks/affiliate',
        text: 'Affiliate Management',
        textKey: 'admin-shell.nav.items.affiliate',
        icon: 'Handshake',
        expandable: true,
        subItems: [
          {
            href: '/insightbooks/affiliate',
            text: 'Affiliates',
            textKey: 'admin-shell.nav.items.affiliateList',
          },
          {
            href: '/insightbooks/affiliate/commissions',
            text: 'Commissions',
            textKey: 'admin-shell.nav.items.commissions',
          },
          {
            href: '/insightbooks/affiliate/payouts',
            text: 'Payouts',
            textKey: 'admin-shell.nav.items.payouts',
          },
        ],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing and Revenue',
    labelKey: 'admin-shell.nav.sections.billing',
    items: [
      {
        href: '/insightbooks/billing',
        text: 'Billing',
        textKey: 'admin-shell.nav.items.billing',
        icon: 'CreditCard',
        expandable: true,
        subItems: [
          {
            href: '/insightbooks/billing/overview',
            text: 'Billing Overview',
            textKey: 'admin-shell.nav.items.billingOverview',
          },
          {
            href: '/insightbooks/billing/plans',
            text: 'Subscription Plans',
            textKey: 'admin-shell.nav.items.plans',
          },
          {
            href: '/insightbooks/billing/mra-eis-plans',
            text: 'MRA EIS Plans',
            textKey: 'admin-shell.nav.items.mraEisPlans',
          },
          {
            href: '/insightbooks/billing/subscriptions',
            text: 'Subscriptions',
            textKey: 'admin-shell.nav.items.subscriptions',
          },
          {
            href: '/insightbooks/billing/invoices',
            text: 'Invoices',
            textKey: 'admin-shell.nav.items.invoices',
          },
          {
            href: '/insightbooks/billing/payments',
            text: 'Payments',
            textKey: 'admin-shell.nav.items.payments',
          },
          {
            href: '/insightbooks/billing/credits',
            text: 'Credits & Refunds',
            textKey: 'admin-shell.nav.items.credits',
          },
          {
            href: '/insightbooks/billing/reconciliation',
            text: 'Reconciliation',
            textKey: 'admin-shell.nav.items.reconciliation',
          },
        ],
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    labelKey: 'admin-shell.nav.sections.communication',
    items: [
      {
        href: '/insightbooks/email-management',
        text: 'Email Management',
        textKey: 'admin-shell.nav.items.email',
        icon: 'Mail',
        expandable: true,
        subItems: [
          {
            href: '/insightbooks/email-management',
            text: 'Send & history',
            textKey: 'admin-shell.nav.items.emailHistory',
          },
          {
            href: '/insightbooks/email-management/templates',
            text: 'Templates',
            textKey: 'admin-shell.nav.items.templates',
          },
          {
            href: '/insightbooks/email-management/suppression',
            text: 'Suppression',
            textKey: 'admin-shell.nav.items.suppression',
          },
        ],
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    labelKey: 'admin-shell.nav.sections.compliance',
    items: [
      {
        href: '/insightbooks/mra-eis',
        text: 'MRA EIS Entitlement',
        textKey: 'admin-shell.nav.items.mraEis',
        icon: 'FileCheck',
        expandable: true,
        subItems: [
          {
            href: '/insightbooks/mra-eis',
            text: 'Entitlements',
            textKey: 'admin-shell.nav.items.entitlements',
            exact: true,
          },
          {
            href: '/insightbooks/mra-eis/centre',
            text: 'Platform Overview',
            textKey: 'admin-shell.nav.items.mraCentre',
          },
          {
            href: '/insightbooks/mra-eis/terminals',
            text: 'Terminals',
            textKey: 'admin-shell.nav.items.terminals',
          },
          {
            href: '/insightbooks/mra-eis/configuration',
            text: 'Configuration',
            textKey: 'admin-shell.nav.items.configuration',
          },
          {
            href: '/insightbooks/mra-eis/mappings',
            text: 'Mappings',
            textKey: 'admin-shell.nav.items.mappings',
          },
          {
            href: '/insightbooks/mra-eis/catalogue',
            text: 'Catalogue',
            textKey: 'admin-shell.nav.items.catalogue',
          },
        ],
      },
    ],
  },
  {
    id: 'security',
    label: 'Security and Operations',
    labelKey: 'admin-shell.nav.sections.security',
    items: [
      {
        href: '/insightbooks/audit',
        text: 'Audit & Security',
        textKey: 'admin-shell.nav.items.auditSecurity',
        icon: 'Shield',
        expandable: true,
        subItems: [
          {
            href: '/insightbooks/audit',
            text: 'Audit log',
            textKey: 'admin-shell.nav.items.auditLog',
          },
          {
            href: '/insightbooks/security',
            text: 'Security overview',
            textKey: 'admin-shell.nav.items.securityOverview',
          },
          {
            href: '/insightbooks/security/monitoring',
            text: 'Monitoring',
            textKey: 'admin-shell.nav.items.monitoring',
          },
          {
            href: '/insightbooks/security/compliance',
            text: 'Compliance signals',
            textKey: 'admin-shell.nav.items.complianceSignals',
          },
        ],
      },
      {
        href: '/insightbooks/system-health',
        text: 'System Health',
        textKey: 'admin-shell.nav.items.systemHealth',
        icon: 'Activity',
      },
      {
        href: '/insightbooks/analytics-pipeline',
        text: 'Analytics pipeline',
        textKey: 'admin-shell.nav.items.analyticsPipeline',
        icon: 'Activity',
      },
    ],
  },
];

/** Resolve display label; prefers i18n key when translator provided. */
export function resolveAdminNavLabel(entry, t) {
  if (!entry) return '';
  if (typeof t === 'function' && entry.textKey) return t(entry.textKey);
  if (typeof t === 'function' && entry.labelKey) return t(entry.labelKey);
  return entry.text || entry.label || '';
}

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

/** Flat unique hrefs from nav (parents + subItems). */
export function listAdminNavHrefs() {
  const hrefs = new Set();
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items || []) {
      if (item.href) hrefs.add(item.href);
      for (const sub of item.subItems || []) {
        if (sub.href) hrefs.add(sub.href);
      }
    }
  }
  return [...hrefs].sort();
}
