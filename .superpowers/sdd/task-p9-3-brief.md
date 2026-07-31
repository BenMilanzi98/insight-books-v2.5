### Task 3: Wave 3 — Workbench UI + nav + i18n

**Files:**
- `lib/admin/productAnalyticsNav.js`
- `components/admin/productAnalytics/*`
- Pages: `app/insightbooks/intelligence/product-analytics/**` (overview, modules, features, adoption, activation, first-value, and matrix-gated stubs for remaining routes from design)
- Modify: `lib/admin/adminNav.js`, `locales/en|ny/admin-pages.json`, `NAV_PERMISSION_MAP` in permissions.js
- Tests: nav permission map / productAnalyticsNav vitest (follow healthCsNav pattern)

**Requirements:**
- Overview shows instrumented commerce metrics (invoice/POS/MRA) via APIs + reliability envelopes
- Uninstrumented modules/features: UNAVAILABLE / NOT_INSTRUMENTED — never 0
- N/A dims labelled clearly
- Nav permission map complete
- en/ny i18n
- Do not build full funnels/cohorts UI depth (Task 4) — stubs OK if gated

- [ ] Overview honest UNAVAILABLE
- [ ] Nav map vitest PASS
- [ ] **Do not git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>"**

## Global Constraints
Phase 9 hard rules; reuse AdminShell / MetricCard patterns from customers/health/revenue.
