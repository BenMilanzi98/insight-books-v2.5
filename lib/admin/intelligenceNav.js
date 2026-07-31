/** Executive Intelligence section nav (Phase 5). */

export const INTEL_EXECUTIVE_BASE = '/insightbooks/intelligence/executive';

export const INTEL_EXECUTIVE_SECTIONS = [
  { id: 'overview', label: 'Overview', href: INTEL_EXECUTIVE_BASE, exact: true },
  {
    id: 'financial',
    label: 'Financial',
    href: `${INTEL_EXECUTIVE_BASE}/financial`,
  },
  {
    id: 'customers',
    label: 'Customers',
    href: `${INTEL_EXECUTIVE_BASE}/customers`,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    href: `${INTEL_EXECUTIVE_BASE}/subscriptions`,
  },
  {
    id: 'engagement',
    label: 'Engagement',
    href: `${INTEL_EXECUTIVE_BASE}/engagement`,
  },
  {
    id: 'products',
    label: 'Products',
    href: `${INTEL_EXECUTIVE_BASE}/products`,
  },
  {
    id: 'mra-eis',
    label: 'MRA EIS',
    href: `${INTEL_EXECUTIVE_BASE}/mra-eis`,
  },
  {
    id: 'operations',
    label: 'Operations',
    href: `${INTEL_EXECUTIVE_BASE}/operations`,
  },
  {
    id: 'security',
    label: 'Security',
    href: `${INTEL_EXECUTIVE_BASE}/security`,
  },
  {
    id: 'attention',
    label: 'Attention',
    href: `${INTEL_EXECUTIVE_BASE}/attention`,
  },
  {
    id: 'reports',
    label: 'Reports',
    href: `${INTEL_EXECUTIVE_BASE}/reports`,
  },
];

export function isIntelExecutiveSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}
