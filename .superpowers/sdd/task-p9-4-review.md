# Task P9-4 Review — Wave 4 Funnels/cohorts/signals/recon/export + Phase 10 pack

**Verdict: Spec Compliance Approved | Task quality Approved**

Read-only re-review after portfolio/Reports fix-up (Important #1–#2 from prior review). Inspected Wave 4 libs, export/overview portfolio paths, nav/Reports permission wiring, section nav gating, APIs, Phase 10 pack, and wave4/nav vitest.

**Vitest (this re-review):** `npx vitest run test/systemAdmin.productAnalytics.wave4.test.js test/systemAdmin.productAnalyticsNav.test.js` → **19 passed (19)**.

**Reviewer:** defect-first Spec Compliance vs Task 4 brief + prior Important residuals (owned-mode on funnels/signals/export; Reports export permission gating).

---

## Spec Compliance

| Area | Status | Notes |
|------|--------|-------|
| Versioned funnels for Invoice / POS / EIS only | **Met** | Unchanged; instrumented-only definitions |
| Funnel incomplete when missing events | **Met** | Null conversion / INCOMPLETE honesty |
| Cohorts first-value anchors; no zero-fill | **Met** | Unchanged |
| Association ≠ causation | **Met** | Disclaimer + `causation: false` |
| Deterministic signals; idempotent identity | **Met** | Unchanged |
| Light recon; failed ≠ false complete | **Met** | Unchanged; owned-mode tenant filter when scoped |
| Export JSON/CSV; permission + portfolio aware | **Met** | `canExport` + owned/none tenant reject; overview counts portfolio-filtered |
| Owned-mode on funnels / signals / export | **Met** | Prior Important #1 fixed (see Verification) |
| Reports gated on export permission | **Met** | Prior Important #2 fixed (see Verification) |
| Wire Task 3 stubs → live Wave 4 | **Met** | Definitions remain stub |
| Phase 10 pack + `READY_FOR_PHASE_10_WITH_BLOCKERS` | **Met** | Final report / inputs / readiness checklist |
| Funnel/signal/recon (+ portfolio) tests PASS | **Met** | **19/19** |
| No git commit | **Met** | Report |

**Overall:** Spec Compliance **Approved** — prior Important gaps closed; honesty/versioning/Phase 10 exit remain sound.

---

## Findings

**No findings.**

Prior Important #1 and #2 are resolved under inspection. Remaining items below are non-blocking follow-ups only (same class as prior Minor).

### Verification — prior Important #1 (portfolio)

- `funnels.js` / `signals.js` / `export.js`: `resolvePortfolioScope`; `none` or owned-tenant miss → `forbidden` + `tenant_out_of_portfolio` before evaluation/export payload.
- `overview.js`: `portfolioTenantFilter` applies `{ in: tenantIds }` / empty-in for owned/none so overview (and overview export) no longer fleet-leaks for agents.
- Cohorts/recon already restricted; recon also filters aggregate owned mode without tenantId.
- Tests cover out-of-portfolio rejection for funnels, signals, export.

### Verification — prior Important #2 (Reports ↔ export)

- `NAV_PERMISSION_MAP[...]/reports` → `productAnalytics.export`.
- `PRODUCT_ANALYTICS_SECTIONS` reports `permission` → export; nav test asserts both + Wave 4 `live`.
- `ProductAnalyticsSectionNav` permission-gates Reports (CS-style disabled span).
- Export pack still returns `export_permission_required` without `canExport`; API 403.

### Minor / follow-up (non-blocking)

1. **Export dataset omits `cohorts`** — Foundation covers overview/funnels/signals/reconciliation only.
2. **UI never requests `format=csv`** — Route supports CSV; Reports UI previews JSON metadata.
3. **Reconcile route `requireReconPerm: false`** — Read-only light recon; manage perm unused on GET.
4. **Reports page has no server-side page guard** — Direct URL can load client shell; API still 403 without export (acceptable CS-style residual).
5. **Signal pack status always `AVAILABLE` for catalogue-only** — Evaluation errors not softened to `UNAVAILABLE`.

---

## What looks solid

- Funnel/cohort/signal/recon honesty constraints hold.
- Portfolio isolation now consistent across funnels, signals, export, overview, cohorts, recon.
- Reports no longer advertised as live to read-only users who would only hit export 403.
- Phase 10 pack correctly exits **READY_FOR_PHASE_10_WITH_BLOCKERS**.
- Vitest covers brief honesty cases plus portfolio isolation and Reports export nav gate.

---

## Task quality

**Approved**

Deliverables match the brief; Important residuals from the first review are fixed with tests. No new correctness/security defects found that the author would need to fix before treating Task 4 as review-clean.
