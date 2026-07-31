/**
 * System-admin MRA EIS section navigation (sidebar + persistent page strip).
 */

export const ADMIN_MRA_EIS_SECTIONS = Object.freeze([
  { id: 'entitlements', label: 'Entitlements', href: '/insightbooks/mra-eis', exact: true },
  { id: 'centre', label: 'Platform Overview', href: '/insightbooks/mra-eis/centre' },
  { id: 'terminals', label: 'Terminals', href: '/insightbooks/mra-eis/terminals' },
  { id: 'configuration', label: 'Configuration', href: '/insightbooks/mra-eis/configuration' },
  { id: 'mappings', label: 'Mappings', href: '/insightbooks/mra-eis/mappings' },
  { id: 'catalogue', label: 'Catalogue', href: '/insightbooks/mra-eis/catalogue' },
]);

export function adminMraEisSidebarSubItems() {
  return ADMIN_MRA_EIS_SECTIONS.map((s) => ({
    href: s.href,
    text: s.label,
    exact: Boolean(s.exact),
  }));
}

export function isAdminMraEisSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (pathname === section.href) return true;
  if (section.exact) return false;
  return pathname.startsWith(`${section.href}/`);
}
