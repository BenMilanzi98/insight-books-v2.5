/** Revenue Intelligence section nav (Phase 6 Wave 2–3). */

export const REVENUE_BASE = '/insightbooks/intelligence/revenue';

/**
 * All Phase 6 revenue workbench section hrefs under /insightbooks/intelligence/revenue/*.
 * Live Wave 2: overview, recurring, mrr, arr, movements (+ reconciliation read-only).
 * Live Wave 3: billing, collections, receivables, payment-performance, credits-refunds, mra-eis.
 * Live Wave 4: customers, segments, concentration, retention, cohorts, subscriptions, plans,
 * forecast, reports, definitions, settings (matrix-gated UNAVAILABLE where data insufficient).
 */
export const REVENUE_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    labelKey: 'admin-pages.revenue.sections.overview',
    href: `${REVENUE_BASE}/overview`,
    exact: true,
    wave: 2,
  },
  {
    id: 'recurring',
    label: 'Recurring',
    labelKey: 'admin-pages.revenue.sections.recurring',
    href: `${REVENUE_BASE}/recurring`,
    wave: 2,
  },
  {
    id: 'mrr',
    label: 'MRR',
    labelKey: 'admin-pages.revenue.sections.mrr',
    href: `${REVENUE_BASE}/mrr`,
    wave: 2,
  },
  {
    id: 'arr',
    label: 'ARR',
    labelKey: 'admin-pages.revenue.sections.arr',
    href: `${REVENUE_BASE}/arr`,
    wave: 2,
  },
  {
    id: 'movements',
    label: 'Movements',
    labelKey: 'admin-pages.revenue.sections.movements',
    href: `${REVENUE_BASE}/movements`,
    wave: 2,
  },
  {
    id: 'billing',
    label: 'Billing',
    labelKey: 'admin-pages.revenue.sections.billing',
    href: `${REVENUE_BASE}/billing`,
    wave: 3,
  },
  {
    id: 'collections',
    label: 'Collections',
    labelKey: 'admin-pages.revenue.sections.collections',
    href: `${REVENUE_BASE}/collections`,
    wave: 3,
  },
  {
    id: 'receivables',
    label: 'Receivables',
    labelKey: 'admin-pages.revenue.sections.receivables',
    href: `${REVENUE_BASE}/receivables`,
    wave: 3,
  },
  {
    id: 'payment-performance',
    label: 'Payment performance',
    labelKey: 'admin-pages.revenue.sections.paymentPerformance',
    href: `${REVENUE_BASE}/payment-performance`,
    wave: 3,
  },
  {
    id: 'credits-refunds',
    label: 'Credits & refunds',
    labelKey: 'admin-pages.revenue.sections.creditsRefunds',
    href: `${REVENUE_BASE}/credits-refunds`,
    wave: 3,
  },
  {
    id: 'mra-eis',
    label: 'MRA EIS',
    labelKey: 'admin-pages.revenue.sections.mraEis',
    href: `${REVENUE_BASE}/mra-eis`,
    wave: 3,
  },
  {
    id: 'customers',
    label: 'Customers',
    labelKey: 'admin-pages.revenue.sections.customers',
    href: `${REVENUE_BASE}/customers`,
    wave: 4,
  },
  {
    id: 'segments',
    label: 'Segments',
    labelKey: 'admin-pages.revenue.sections.segments',
    href: `${REVENUE_BASE}/segments`,
    wave: 4,
  },
  {
    id: 'concentration',
    label: 'Concentration',
    labelKey: 'admin-pages.revenue.sections.concentration',
    href: `${REVENUE_BASE}/concentration`,
    wave: 4,
  },
  {
    id: 'retention',
    label: 'Retention',
    labelKey: 'admin-pages.revenue.sections.retention',
    href: `${REVENUE_BASE}/retention`,
    wave: 4,
  },
  {
    id: 'cohorts',
    label: 'Cohorts',
    labelKey: 'admin-pages.revenue.sections.cohorts',
    href: `${REVENUE_BASE}/cohorts`,
    wave: 4,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    labelKey: 'admin-pages.revenue.sections.subscriptions',
    href: `${REVENUE_BASE}/subscriptions`,
    wave: 4,
  },
  {
    id: 'plans',
    label: 'Plans',
    labelKey: 'admin-pages.revenue.sections.plans',
    href: `${REVENUE_BASE}/plans`,
    wave: 4,
  },
  {
    id: 'forecast',
    label: 'Forecast',
    labelKey: 'admin-pages.revenue.sections.forecast',
    href: `${REVENUE_BASE}/forecast`,
    wave: 4,
  },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    labelKey: 'admin-pages.revenue.sections.reconciliation',
    href: `${REVENUE_BASE}/reconciliation`,
    wave: 2,
  },
  {
    id: 'reports',
    label: 'Reports',
    labelKey: 'admin-pages.revenue.sections.reports',
    href: `${REVENUE_BASE}/reports`,
    wave: 4,
  },
  {
    id: 'definitions',
    label: 'Definitions',
    labelKey: 'admin-pages.revenue.sections.definitions',
    href: `${REVENUE_BASE}/definitions`,
    wave: 4,
  },
  {
    id: 'settings',
    label: 'Settings',
    labelKey: 'admin-pages.revenue.sections.settings',
    href: `${REVENUE_BASE}/settings`,
    wave: 4,
  },
];

/** Client-side metric filters for Wave 2 detail pages (pack APIs only). */
export const REVENUE_PAGE_METRIC_CODES = Object.freeze({
  mrr: [
    'revenue.mrr.estimated_total',
    'revenue.mrr.estimated_core',
    'revenue.mrr.estimated_mra_eis',
    'revenue.arpa',
    'revenue.mrr.cross_currency_total',
  ],
  arr: ['revenue.arr.estimated'],
  movements: [
    'revenue.mrr.bridge.opening',
    'revenue.mrr.bridge.closing',
    'revenue.mrr.bridge.new',
    'revenue.mrr.bridge.expansion',
    'revenue.mrr.bridge.contraction',
    'revenue.mrr.bridge.churned',
    'revenue.mrr.bridge.reactivation',
    'revenue.mrr.bridge.net_new',
  ],
});

export function isRevenueSectionActive(pathname, section) {
  if (!pathname || !section?.href) return false;
  if (section.exact) {
    return pathname === section.href || pathname === `${section.href}/`;
  }
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

export function listRevenueSectionHrefs() {
  return REVENUE_SECTIONS.map((s) => s.href);
}
