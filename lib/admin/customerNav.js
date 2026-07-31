/** Customer Intelligence section nav (Phase 7 Wave 2). */

export const CUSTOMER_BASE = '/insightbooks/intelligence/customers';

/**
 * Workbench section hrefs under /insightbooks/intelligence/customers/*.
 * Live: overview, directory, [tenantId] 360, portfolios, signals, reconciliation, reports.
 * Remaining stubs: adoption/support (matrix), some section hubs.
 */
export const CUSTOMER_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    labelKey: 'admin-pages.customers.sections.overview',
    href: `${CUSTOMER_BASE}/overview`,
    exact: true,
    wave: 2,
  },
  {
    id: 'directory',
    label: 'Directory',
    labelKey: 'admin-pages.customers.sections.directory',
    href: `${CUSTOMER_BASE}/directory`,
    wave: 2,
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    labelKey: 'admin-pages.customers.sections.lifecycle',
    href: `${CUSTOMER_BASE}/lifecycle`,
    wave: 2,
  },
  {
    id: 'engagement',
    label: 'Engagement',
    labelKey: 'admin-pages.customers.sections.engagement',
    href: `${CUSTOMER_BASE}/engagement`,
    wave: 2,
  },
  {
    id: 'commercial',
    label: 'Commercial',
    labelKey: 'admin-pages.customers.sections.commercial',
    href: `${CUSTOMER_BASE}/commercial`,
    wave: 2,
  },
  {
    id: 'renewals',
    label: 'Renewals',
    labelKey: 'admin-pages.customers.sections.renewals',
    href: `${CUSTOMER_BASE}/renewals`,
    wave: 2,
  },
  {
    id: 'mra-eis',
    label: 'MRA EIS',
    labelKey: 'admin-pages.customers.sections.mraEis',
    href: `${CUSTOMER_BASE}/mra-eis`,
    wave: 2,
  },
  {
    id: 'adoption',
    label: 'Adoption',
    labelKey: 'admin-pages.customers.sections.adoption',
    href: `${CUSTOMER_BASE}/adoption`,
    wave: 2,
  },
  {
    id: 'support',
    label: 'Support',
    labelKey: 'admin-pages.customers.sections.support',
    href: `${CUSTOMER_BASE}/support`,
    wave: 2,
  },
  {
    id: 'signals',
    label: 'Signals',
    labelKey: 'admin-pages.customers.sections.signals',
    href: `${CUSTOMER_BASE}/signals`,
    wave: 4,
  },
  {
    id: 'portfolios',
    label: 'Portfolios',
    labelKey: 'admin-pages.customers.sections.portfolios',
    href: `${CUSTOMER_BASE}/portfolios`,
    wave: 3,
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    labelKey: 'admin-pages.customers.sections.reconciliation',
    href: `${CUSTOMER_BASE}/reconciliation`,
    wave: 4,
  },
  {
    id: 'reports',
    label: 'Reports',
    labelKey: 'admin-pages.customers.sections.reports',
    href: `${CUSTOMER_BASE}/reports`,
    wave: 4,
  },
  {
    id: 'definitions',
    label: 'Definitions',
    labelKey: 'admin-pages.customers.sections.definitions',
    href: `${CUSTOMER_BASE}/definitions`,
    wave: 2,
  },
  {
    id: 'settings',
    label: 'Settings',
    labelKey: 'admin-pages.customers.sections.settings',
    href: `${CUSTOMER_BASE}/settings`,
    wave: 2,
  },
];

const STATIC_SECTION_IDS = new Set(CUSTOMER_SECTIONS.map((s) => s.id));

/** True when pathname is a customer 360 detail route (/customers/:tenantId). */
export function isCustomerDetailPath(pathname) {
  if (!pathname) return false;
  const base = CUSTOMER_BASE;
  if (pathname === base || pathname === `${base}/`) return false;
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length + 1).replace(/\/$/, '');
  if (!rest || rest.includes('/')) return false;
  return !STATIC_SECTION_IDS.has(rest);
}

export function customerDetailHref(tenantId) {
  return `${CUSTOMER_BASE}/${encodeURIComponent(tenantId)}`;
}

export function isCustomerSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.id === 'directory' && isCustomerDetailPath(pathname)) {
    return true;
  }
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listCustomerSectionHrefs() {
  return CUSTOMER_SECTIONS.map((s) => s.href);
}
