/**
 * Customer Success Ops section nav (Phase 8 Wave 2 shell).
 * Cases/tasks engines land in Wave 3 — stubs are matrix-gated here.
 */

export const CS_BASE = '/insightbooks/customer-success';

/** Permission keys (mirrored from SYSTEM_ADMIN_PERMISSIONS.customerSuccess). */
export const CS_PERMISSIONS = Object.freeze({
  read: 'systemAdmin.customerSuccess.read',
  manageCases: 'systemAdmin.customerSuccess.manageCases',
  manageRenewals: 'systemAdmin.customerSuccess.manageRenewals',
});

/**
 * @typedef {'live'|'stub'|'unavailable'} CsReadiness
 * @typedef {{
 *   id: string,
 *   label: string,
 *   labelKey: string,
 *   href: string,
 *   exact?: boolean,
 *   wave: number,
 *   readiness: CsReadiness,
 *   permission: string,
 * }} CsSection
 */

/** @type {CsSection[]} */
export const CS_SECTIONS = [
  {
    id: 'command-centre',
    label: 'Command Centre',
    labelKey: 'admin-pages.customerSuccess.sections.commandCentre',
    hintKey: 'admin-pages.customerSuccess.sectionHints.commandCentre',
    href: `${CS_BASE}/command-centre`,
    exact: true,
    wave: 2,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'cases',
    label: 'Cases',
    labelKey: 'admin-pages.customerSuccess.sections.cases',
    hintKey: 'admin-pages.customerSuccess.sectionHints.cases',
    href: `${CS_BASE}/cases`,
    wave: 3,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    labelKey: 'admin-pages.customerSuccess.sections.tasks',
    hintKey: 'admin-pages.customerSuccess.sectionHints.tasks',
    href: `${CS_BASE}/tasks`,
    wave: 3,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'interventions',
    label: 'Interventions',
    labelKey: 'admin-pages.customerSuccess.sections.interventions',
    hintKey: 'admin-pages.customerSuccess.sectionHints.interventions',
    href: `${CS_BASE}/interventions`,
    wave: 3,
    readiness: 'live',
    permission: CS_PERMISSIONS.manageCases,
  },
  {
    id: 'renewals',
    label: 'Renewals',
    labelKey: 'admin-pages.customerSuccess.sections.renewals',
    hintKey: 'admin-pages.customerSuccess.sectionHints.renewals',
    href: `${CS_BASE}/renewals`,
    wave: 3,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'playbooks',
    label: 'Playbooks',
    labelKey: 'admin-pages.customerSuccess.sections.playbooks',
    hintKey: 'admin-pages.customerSuccess.sectionHints.playbooks',
    href: `${CS_BASE}/playbooks`,
    wave: 4,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'success-plans',
    label: 'Success plans',
    labelKey: 'admin-pages.customerSuccess.sections.successPlans',
    hintKey: 'admin-pages.customerSuccess.sectionHints.successPlans',
    href: `${CS_BASE}/success-plans`,
    wave: 4,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    labelKey: 'admin-pages.customerSuccess.sections.onboarding',
    hintKey: 'admin-pages.customerSuccess.sectionHints.onboarding',
    href: `${CS_BASE}/onboarding`,
    wave: 4,
    readiness: 'unavailable',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'training',
    label: 'Training',
    labelKey: 'admin-pages.customerSuccess.sections.training',
    hintKey: 'admin-pages.customerSuccess.sectionHints.training',
    href: `${CS_BASE}/training`,
    wave: 4,
    readiness: 'unavailable',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'surveys',
    label: 'Surveys',
    labelKey: 'admin-pages.customerSuccess.sections.surveys',
    hintKey: 'admin-pages.customerSuccess.sectionHints.surveys',
    href: `${CS_BASE}/surveys`,
    wave: 4,
    readiness: 'unavailable',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'handoffs',
    label: 'Expansion handoffs',
    labelKey: 'admin-pages.customerSuccess.sections.handoffs',
    hintKey: 'admin-pages.customerSuccess.sectionHints.handoffs',
    href: `${CS_BASE}/handoffs`,
    wave: 4,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
  {
    id: 'reports',
    label: 'Reports',
    labelKey: 'admin-pages.customerSuccess.sections.reports',
    hintKey: 'admin-pages.customerSuccess.sectionHints.reports',
    href: `${CS_BASE}/reports`,
    wave: 4,
    readiness: 'live',
    permission: CS_PERMISSIONS.read,
  },
];

export function isCsSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listCustomerSuccessSectionHrefs() {
  return [CS_BASE, ...CS_SECTIONS.map((s) => s.href)];
}
