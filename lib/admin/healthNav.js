/** Customer Health Intelligence section nav (Phase 8 Wave 2). */

export const HEALTH_BASE = '/insightbooks/intelligence/customer-health';

/**
 * Workbench section hrefs under /insightbooks/intelligence/customer-health/*.
 * Live Wave 2: overview, definitions, snapshots, reconciliation, reports + [tenantId] detail.
 */
export const HEALTH_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    labelKey: 'admin-pages.customerHealth.sections.overview',
    href: `${HEALTH_BASE}/overview`,
    exact: true,
    wave: 2,
  },
  {
    id: 'definitions',
    label: 'Definitions',
    labelKey: 'admin-pages.customerHealth.sections.definitions',
    href: `${HEALTH_BASE}/definitions`,
    wave: 2,
  },
  {
    id: 'snapshots',
    label: 'Snapshots',
    labelKey: 'admin-pages.customerHealth.sections.snapshots',
    href: `${HEALTH_BASE}/snapshots`,
    wave: 2,
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    labelKey: 'admin-pages.customerHealth.sections.reconciliation',
    href: `${HEALTH_BASE}/reconciliation`,
    wave: 2,
  },
  {
    id: 'reports',
    label: 'Reports',
    labelKey: 'admin-pages.customerHealth.sections.reports',
    href: `${HEALTH_BASE}/reports`,
    wave: 2,
  },
];

const STATIC_SECTION_IDS = new Set(HEALTH_SECTIONS.map((s) => s.id));

/** True when pathname is a health tenant detail route (/customer-health/:tenantId). */
export function isHealthDetailPath(pathname) {
  if (!pathname) return false;
  const base = HEALTH_BASE;
  if (pathname === base || pathname === `${base}/`) return false;
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length + 1).replace(/\/$/, '');
  if (!rest || rest.includes('/')) return false;
  return !STATIC_SECTION_IDS.has(rest);
}

export function healthDetailHref(tenantId) {
  return `${HEALTH_BASE}/${encodeURIComponent(tenantId)}`;
}

export function isHealthSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.id === 'overview' && isHealthDetailPath(pathname)) {
    return true;
  }
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listHealthSectionHrefs() {
  return [
    HEALTH_BASE,
    ...HEALTH_SECTIONS.map((s) => s.href),
  ];
}
