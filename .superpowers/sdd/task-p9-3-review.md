# Task P9-3 Review — Wave 3 Workbench UI + nav + i18n

**Verdict: Spec Compliance Approved | Task quality Approved**

Read-only review of brief, report, `productAnalyticsNav`, overview pack/API/views, catalogue + inspect + stub pages, `adminNav` / `NAV_PERMISSION_MAP`, en|ny locales, and MetricCard honesty. Vitest **not re-run** (implementer reported **24 passed**; no doubt from static review).

**Reviewer:** defect-first Spec Compliance vs Task 3 brief + Phase 9 hard rules.

---

## Spec Compliance

| Area | Status | Notes |
|------|--------|-------|
| `productAnalyticsNav` + section hrefs (live Wave 3 + Task 4 stubs) | **Met** | overview…first-value live; funnels/cohorts/signals/definitions/reconciliation/reports stub |
| AdminShell / `adminNav` entry | **Met** | Product Analytics → `/…/product-analytics/overview`; `Boxes` icon wired |
| `NAV_PERMISSION_MAP` complete for section hrefs | **Met** | Base + all 12 sections → `productAnalyticsRead` |
| Overview commerce metrics (invoice / POS / MRA) via API + envelopes | **Met** | `buildProductAnalyticsOverviewPack` + `/overview` GET; reliability gate then fact count |
| Honest `UNAVAILABLE` / `NOT_INSTRUMENTED` — never false zeros | **Met** | Query/model failure → `UNAVAILABLE` + `value: null`; catalogue N/A; MetricCard does not coerce null→0 |
| N/A dims labelled clearly | **Met** | `naLabel` / i18n `naHint` / catalogue value column |
| Live modules / features / adoption / activation / first-value | **Met** | Catalogue + inspect views; inspect uses read-only adoption/first-value GET; activation `persist: false` |
| Matrix-gated stubs (no full funnels/cohorts depth) | **Met** | `ProductAnalyticsStubView` + NOT_INSTRUMENTED / UNAVAILABLE badges |
| en / ny i18n | **Met** | `admin-pages.productAnalytics.*` + shell nav label in both locales |
| No CoA admin route | **Met** | No CoA under product-analytics; `adminNav` still documents CoA removed |
| No inventing adoption numbers | **Met** | Overview = commerce counts only; catalogue values always null/N/A; no aggregate adoption KPIs |
| Nav map vitest PASS | **Met (reported)** | Implementer: 24/24 across PA nav + navPermissionMap + shellNav + catalogue |
| No git commit | **Met** | Report |

**Overall:** Spec Compliance **Approved**.

---

## Findings

**No Critical or Important findings.**

### Minor / follow-up (non-blocking)

1. **No dedicated overview-pack honesty test** — Acceptance for “Overview honest UNAVAILABLE” is enforced in `overview.js` + MetricCard / `metricEnvelope`, but Task 3 vitest coverage is nav/page-existence oriented. A small unit test for `count` failure → `UNAVAILABLE`/`null` would lock the gate.
2. **First-value inspect status is inferred** — `ProductAnalyticsInspectView` maps a loaded fact → `AVAILABLE` / missing → `UNAVAILABLE`. Uninstrumented features with no row stay `UNAVAILABLE` (GET `loadFirstValue` does not gate instrumentation). Not a false zero; adoption/activation paths already return `NOT_INSTRUMENTED`.
3. **Catalogue status label vs overview snapshot** — Instrumented modules show `AVAILABLE` in the table; overview badges remap to `INSTRUMENTED`. Harmless but slightly inconsistent.
4. **MetricCard `NOT_INSTRUMENTED` copy is English-only** — `"Not instrumented"` / `"Unavailable"` hardcoded; page chrome is en/ny.
5. **Nav tests do not assert stub page files** — Stub routes exist on disk; only live Wave 3 pages are `existsSync`-checked.

---

## What looks solid

- Commerce trio counts only after reliability `AVAILABLE`; failures never coerced to `0`.
- Catalogue / modules / features always show `N/A` for value — no invented adoption/usage totals.
- Wave 4 surfaces are explicit stubs with honesty badges, not fake dashboards.
- Permission map covers every `listProductAnalyticsSectionHrefs()` entry.
- Inspect paths avoid mutating adoption (no `persist`) and activation passes `persist: false`.
- CoA stays out of the control plane; Product Analytics does not reintroduce it.

---

## Task quality

**Approved**

Workbench shell matches the brief: nav + permissions + i18n + honest overview + live Wave 3 pages + gated stubs. Honesty constraints hold under code inspection. Residuals are Minor (test depth / label polish), not blockers for Task 4.

**Vitest:** Not re-run this review. Implementer evidence: `npx vitest run test/systemAdmin.productAnalyticsNav.test.js test/systemAdmin.navPermissionMap.test.js test/systemAdmin.shellNav.test.js test/systemAdmin.productAnalytics.catalogue.test.js` → **24 passed (24)**.
