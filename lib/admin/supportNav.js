/**
 * Support Ops section nav (Phase 10 Waves 3–4 shell).
 * Distinct from Customer Success — Support Ticket ≠ CsCase.
 */

export const SUPPORT_BASE = '/insightbooks/support';

/** Permission keys (mirrored from SYSTEM_ADMIN_PERMISSIONS.support). */
export const SUPPORT_PERMISSIONS = Object.freeze({
  viewTickets: 'systemAdmin.support.viewTickets',
  manageSla: 'systemAdmin.support.manageSla',
  export: 'systemAdmin.support.export',
  runReconciliation: 'systemAdmin.support.runReconciliation',
});

/**
 * @typedef {'live'|'stub'|'unavailable'} SupportReadiness
 * @typedef {{
 *   id: string,
 *   label: string,
 *   labelKey: string,
 *   href: string,
 *   exact?: boolean,
 *   wave: number,
 *   readiness: SupportReadiness,
 *   permission: string,
 * }} SupportSection
 */

/** @type {SupportSection[]} */
export const SUPPORT_SECTIONS = [
  {
    id: 'my-work',
    label: 'My Work',
    labelKey: 'admin-pages.support.sections.myWork',
    hintKey: 'admin-pages.support.sectionHints.myWork',
    href: `${SUPPORT_BASE}`,
    exact: true,
    wave: 3,
    readiness: 'live',
    permission: SUPPORT_PERMISSIONS.viewTickets,
  },
  {
    id: 'tickets',
    label: 'Tickets',
    labelKey: 'admin-pages.support.sections.tickets',
    hintKey: 'admin-pages.support.sectionHints.tickets',
    href: `${SUPPORT_BASE}/tickets`,
    wave: 3,
    readiness: 'live',
    permission: SUPPORT_PERMISSIONS.viewTickets,
  },
  {
    id: 'handoffs',
    label: 'Handoffs',
    labelKey: 'admin-pages.support.sections.handoffs',
    hintKey: 'admin-pages.support.sectionHints.handoffs',
    href: `${SUPPORT_BASE}/handoffs`,
    wave: 4,
    readiness: 'live',
    permission: SUPPORT_PERMISSIONS.viewTickets,
  },
  {
    id: 'reports',
    label: 'Reports',
    labelKey: 'admin-pages.support.sections.reports',
    hintKey: 'admin-pages.support.sectionHints.reports',
    href: `${SUPPORT_BASE}/reports`,
    wave: 4,
    readiness: 'live',
    permission: SUPPORT_PERMISSIONS.viewTickets,
  },
  {
    id: 'foundations',
    label: 'Foundations',
    labelKey: 'admin-pages.support.sections.foundations',
    hintKey: 'admin-pages.support.sectionHints.foundations',
    href: `${SUPPORT_BASE}/foundations`,
    wave: 4,
    readiness: 'stub',
    permission: SUPPORT_PERMISSIONS.viewTickets,
  },
];

export function isSupportSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listSupportSectionHrefs() {
  return [SUPPORT_BASE, ...SUPPORT_SECTIONS.map((s) => s.href)].filter(
    (href, idx, arr) => arr.indexOf(href) === idx
  );
}
