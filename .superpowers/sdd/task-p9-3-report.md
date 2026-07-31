# Task P9-3 Report — Wave 3 Workbench UI + nav + i18n

**Status:** DONE  
**Date:** 2026-07-29  
**Commits:** none — commit deferred  

## Summary

Implemented the Product Analytics workbench shell: section nav, AdminShell entry, permission map coverage, en/ny i18n, overview API pack with honesty gates, live modules/features/adoption/activation/first-value pages, and matrix-gated Wave 4 stubs. Uninstrumented catalogue rows and failed fact reads surface as `NOT_INSTRUMENTED` / `UNAVAILABLE` / `N/A` — never false zeros.

## Acceptance

| Check | Result |
|-------|--------|
| Overview honest UNAVAILABLE / NOT_INSTRUMENTED | **PASS** — commerce metrics from usage facts; query failure → UNAVAILABLE (value null); uninstrumented catalogue → N/A |
| Nav map vitest PASS | **PASS** — `test/systemAdmin.productAnalyticsNav.test.js` + related nav tests |
| Do not git commit | **Honoured** |

## TDD evidence

1. Wrote `test/systemAdmin.productAnalyticsNav.test.js` (href map, adminNav entry, page files).
2. Implemented nav / pages / overview pack / i18n / permissions.
3. Final run: **`npx vitest run test/systemAdmin.productAnalyticsNav.test.js test/systemAdmin.navPermissionMap.test.js test/systemAdmin.shellNav.test.js test/systemAdmin.productAnalytics.catalogue.test.js` → 24 passed (24)**.

## Files created

### Nav / pack / API
- `lib/admin/productAnalyticsNav.js`
- `lib/admin/productAnalytics/overview.js`
- `app/api/admin/intelligence/product-analytics/overview/route.js`
- `test/systemAdmin.productAnalyticsNav.test.js`

### Components
- `components/admin/productAnalytics/ProductAnalyticsSectionNav.jsx`
- `components/admin/productAnalytics/ProductAnalyticsOverviewView.jsx`
- `components/admin/productAnalytics/ProductAnalyticsCatalogueView.jsx`
- `components/admin/productAnalytics/ProductAnalyticsInspectView.jsx`
- `components/admin/productAnalytics/ProductAnalyticsStubView.jsx`

### Pages
- `app/insightbooks/intelligence/product-analytics/page.js` (redirect → overview)
- `…/overview|modules|features|adoption|activation|first-value/page.js` (live)
- `…/funnels|cohorts|signals|definitions|reconciliation|reports/page.js` (stubs)

## Files modified

- `lib/admin/adminNav.js` — Product Analytics overview item
- `lib/admin/permissions.js` — adoption / activation / first-value / funnels / cohorts / signals hrefs
- `lib/admin/productAnalytics/index.js` — re-export overview
- `components/admin/index.js` — export PA views
- `components/admin/intelligence/MetricCard.jsx` — `NOT_INSTRUMENTED` tone/label
- `components/AdminSidebar/AdminSidebar.js` — `Boxes` icon
- `locales/en|ny/admin-pages.json` — `productAnalytics.*`
- `locales/en|ny/admin-shell.json` — nav item label

## Honesty notes

- Instrumented commerce trio may show real `0` only when usage-fact counts succeed.
- Fact model/query failure → `UNAVAILABLE` with null value (never coerced to 0).
- Uninstrumented modules/features render status badges + `N/A` in value column.
- Wave 4 funnels/cohorts/signals stubs explicitly `NOT_INSTRUMENTED`.

## Follow-ups (Task 4)

- Full funnels / cohorts / signals / reconciliation / export UI depth
- Definition browser beyond overview catalogue version
