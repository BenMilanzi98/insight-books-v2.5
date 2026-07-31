/** Product Analytics workbench section nav (Phase 9 Wave 3). */



import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions.js';



export const PRODUCT_ANALYTICS_BASE = '/insightbooks/intelligence/product-analytics';



/** Permission keys for section gating (Reports requires export). */

export const PRODUCT_ANALYTICS_PERMISSIONS = Object.freeze({

  read: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,

  export: SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport,

});



/**

 * Workbench section hrefs under /insightbooks/intelligence/product-analytics/*.

 * Live: overview, modules, features, adoption, activation, first-value,

 *        funnels, cohorts, signals, reconciliation, reports (Wave 4 foundations).

 * Stub: definitions (catalogue version on overview).

 * Reports requires productAnalytics.export (export API) — not live→403 for read-only.

 */

export const PRODUCT_ANALYTICS_SECTIONS = [

  {

    id: 'overview',

    label: 'Overview',

    labelKey: 'admin-pages.productAnalytics.sections.overview',

    href: `${PRODUCT_ANALYTICS_BASE}/overview`,

    exact: true,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'modules',

    label: 'Modules',

    labelKey: 'admin-pages.productAnalytics.sections.modules',

    href: `${PRODUCT_ANALYTICS_BASE}/modules`,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'features',

    label: 'Features',

    labelKey: 'admin-pages.productAnalytics.sections.features',

    href: `${PRODUCT_ANALYTICS_BASE}/features`,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'adoption',

    label: 'Adoption',

    labelKey: 'admin-pages.productAnalytics.sections.adoption',

    href: `${PRODUCT_ANALYTICS_BASE}/adoption`,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'activation',

    label: 'Activation',

    labelKey: 'admin-pages.productAnalytics.sections.activation',

    href: `${PRODUCT_ANALYTICS_BASE}/activation`,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'first-value',

    label: 'First value',

    labelKey: 'admin-pages.productAnalytics.sections.firstValue',

    href: `${PRODUCT_ANALYTICS_BASE}/first-value`,

    wave: 3,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'funnels',

    label: 'Funnels',

    labelKey: 'admin-pages.productAnalytics.sections.funnels',

    href: `${PRODUCT_ANALYTICS_BASE}/funnels`,

    wave: 4,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'cohorts',

    label: 'Cohorts',

    labelKey: 'admin-pages.productAnalytics.sections.cohorts',

    href: `${PRODUCT_ANALYTICS_BASE}/cohorts`,

    wave: 4,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'signals',

    label: 'Signals',

    labelKey: 'admin-pages.productAnalytics.sections.signals',

    href: `${PRODUCT_ANALYTICS_BASE}/signals`,

    wave: 4,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'definitions',

    label: 'Definitions',

    labelKey: 'admin-pages.productAnalytics.sections.definitions',

    href: `${PRODUCT_ANALYTICS_BASE}/definitions`,

    wave: 3,

    readiness: 'stub',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'reconciliation',

    label: 'Reconciliation',

    labelKey: 'admin-pages.productAnalytics.sections.reconciliation',

    href: `${PRODUCT_ANALYTICS_BASE}/reconciliation`,

    wave: 4,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.read,

  },

  {

    id: 'reports',

    label: 'Reports',

    labelKey: 'admin-pages.productAnalytics.sections.reports',

    href: `${PRODUCT_ANALYTICS_BASE}/reports`,

    wave: 4,

    readiness: 'live',

    permission: PRODUCT_ANALYTICS_PERMISSIONS.export,

  },

];



export function isProductAnalyticsSectionActive(pathname, section) {

  if (!pathname || !section?.href) return false;

  if (section.exact) {

    return pathname === section.href || pathname === `${section.href}/`;

  }

  return pathname === section.href || pathname.startsWith(`${section.href}/`);

}



export function listProductAnalyticsSectionHrefs() {

  return [

    PRODUCT_ANALYTICS_BASE,

    ...PRODUCT_ANALYTICS_SECTIONS.map((s) => s.href),

  ];

}


