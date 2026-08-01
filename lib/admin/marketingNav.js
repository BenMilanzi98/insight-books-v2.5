/**
 * Marketing nav — Phase 23 Wave 1.
 * Marketing Campaign ≠ Affiliate campaign. Lead source SoT remains CRM.
 */

export const MARKETING_BASE = '/insightbooks/marketing';

export const MARKETING_PERMISSIONS = Object.freeze({
  view: 'systemAdmin.marketing.view',
  manageCampaigns: 'systemAdmin.marketing.manageCampaigns',
  createCampaigns: 'systemAdmin.marketing.createCampaigns',
  editCampaigns: 'systemAdmin.marketing.editCampaigns',
  manageTaxonomy: 'systemAdmin.marketing.manageTaxonomy',
  manageNormalisation: 'systemAdmin.marketing.manageNormalisation',
  viewLeadSourceEvidence: 'systemAdmin.marketing.viewLeadSourceEvidence',
  export: 'systemAdmin.marketing.export',
});

export const MARKETING_NAV_ITEM = Object.freeze({
  href: MARKETING_BASE,
  text: 'Marketing',
  textKey: 'admin-shell.nav.items.marketing',
  icon: 'Megaphone',
  expandable: true,
  subItems: Object.freeze([
    {
      href: `${MARKETING_BASE}/overview`,
      text: 'Overview',
      textKey: 'admin-shell.nav.items.marketingOverview',
    },
    {
      href: `${MARKETING_BASE}/campaigns`,
      text: 'Campaigns',
      textKey: 'admin-shell.nav.items.marketingCampaigns',
    },
    {
      href: `${MARKETING_BASE}/taxonomy`,
      text: 'Taxonomy',
      textKey: 'admin-shell.nav.items.marketingTaxonomy',
    },
    {
      href: `${MARKETING_BASE}/normalisation`,
      text: 'Normalisation',
      textKey: 'admin-shell.nav.items.marketingNormalisation',
    },
    {
      href: `${MARKETING_BASE}/lead-sources`,
      text: 'Lead sources (CRM evidence)',
      textKey: 'admin-shell.nav.items.marketingLeadSources',
    },
  ]),
});

/** @type {Array<{ id: string, label: string, href: string, exact?: boolean, permission: string }>} */
export const MARKETING_SECTIONS = MARKETING_NAV_ITEM.subItems.map((item, idx) => ({
  id: ['overview', 'campaigns', 'taxonomy', 'normalisation', 'lead-sources'][idx],
  label: item.text,
  href: item.href,
  exact: item.href.endsWith('/overview'),
  permission:
    item.href.endsWith('/lead-sources')
      ? MARKETING_PERMISSIONS.viewLeadSourceEvidence
      : MARKETING_PERMISSIONS.view,
}));

export function isMarketingSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listMarketingSectionHrefs() {
  return [MARKETING_BASE, ...MARKETING_NAV_ITEM.subItems.map((s) => s.href)];
}
