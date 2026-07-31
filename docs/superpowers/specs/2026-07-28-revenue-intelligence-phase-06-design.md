# Revenue Intelligence Phase 6 — Design

**Status:** Approved (conversation + written spec, 2026-07-28); Wave 0 docs complete  

**Date:** 2026-07-28  
**Primary surface:** `/insightbooks/intelligence/revenue`  
**Architecture:** Approach B — Revenue domain + snapshot read models

---

## 1. Purpose

Implement a complete **Revenue Intelligence Workbench** on the InsightBooks platform control plane so authorised management, Finance, and Audit users can understand recurring commercial performance, billing/collections, retention/cohorts (where data allows), deterministic renewal exposure, and reconciliation — using **platform billing only**.

This phase consumes Phases 1–5. It does **not** treat tenant GL, tenant P&L, or Tenant Sale as SaaS revenue.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | **Wave 0 first** — handoff docs + readiness matrix before engines/UI |
| History | **Reconstruct-then-snapshot** — best-effort history from `AccountSubscription` + subscription facts; persist daily/monthly MRR snapshots going forward; non-reconstructable periods → **UNAVAILABLE** (never invent bridge numbers) |
| Product split | **Combined platform recurring** + **CORE / MRA EIS** breakdowns wherever product is known |
| Currency | **Native currency only** + **explicit FX gate**; combined cross-currency total only when a documented FX rate source exists; otherwise UNAVAILABLE |
| Architecture | **Revenue domain services** + snapshot read models; server-authoritative; Phase 5 metric envelopes |

---

## 3. Hard rules

- Platform billing is the commercial source of truth; posted tenant journals remain tenant accounting truth.
- Platform and tenant revenue must never be combined.
- **Billed, collected, contracted (estimated recurring), and recognised** values must remain distinct; do not label a value “revenue” when meaning is ambiguous.
- Verified and reconciled data only; **no false zeroes**; no fake production metrics.
- No client-side authoritative calculations; no hardcoded financial values.
- No silent multi-currency consolidation; no duplicated subscription/payment effects.
- No cross-tenant exposure; no secret exposure.
- No accounting logic changes; no billing workflow regression; no MRA EIS fiscal behaviour changes; no data loss.
- Do not build detailed analytics on metrics Phase 5 / Wave 0 mark as unsupported, unreconciled, stale beyond policy, blocked by quality, or missing backfill — show UNAVAILABLE instead.

---

## 4. Wave 0 — Readiness (docs only; first deliverable)

Create `docs/admin-intelligence-crm/phase-06/` and Phase 5 handoff stubs:

### 4.1 Phase 5 → 6 handoff (under phase-05 if missing)

- `PHASE_06_INPUTS.md`
- `PHASE_06_READINESS_CHECKLIST.md`
- `FINAL_READINESS_DECISION.md` (CONDITIONAL GO / blockers)

### 4.2 Phase 6 audit pack (minimum)

| Doc | Purpose |
|-----|---------|
| `README.md` | Index |
| `PHASE_06_SCOPE.md` | In / out of scope |
| `PHASE_INPUT_VALIDATION.md` | What prior phases actually provide |
| `REVENUE_METRIC_READINESS_MATRIX.md` | Per-metric READY / READY_WITH_LIMITATIONS / UNAVAILABLE / DEFER |
| `PLATFORM_REVENUE_SOURCE_MAP.md` | Subscription → Invoice → Payment → Credit/Refund |
| `MRR_BRIDGE_METHODOLOGY.md` | Reconstruct rules, snapshot keys, gap handling |
| `CURRENCY_AND_FX_POLICY.md` | Per-currency + FX gate |
| `PRODUCT_SPLIT_CORE_EIS.md` | Combined + CORE/EIS split rules |
| `PHASE_06_GAP_REGISTER.md` | Gaps and deferrals |
| `IMPLEMENTATION_PLAN.md` | Pointer to superpowers plan |

**Gate:** No Card/engine implementation for a metric until the matrix classifies it as READY or READY_WITH_LIMITATIONS (with limitations shown in UI).

---

## 5. Domain architecture

```text
AccountSubscription (+ AnalyticsFactSubscription)
        → reconstruct historical estimated MRR (best-effort)
        → daily/monthly snapshots (metricKey family: mrr_*)
        → forward producers on subscription/payment events
PlatformInvoice / PlatformPayment / PlatformCredit / PlatformRefund
        → billed / collected / outstanding / ageing / payment performance
PlatformPlanVersion.planCategory (CORE | MRA_EIS) + plan codes
        → product split on recurring metrics where known
Executive KPI pack (Phase 5)
        → soft-link into Revenue workbench (shared definitions; no duplicate math)
```

### 5.1 Economic labels (canonical)

| Label | Meaning | Primary sources |
|-------|---------|-----------------|
| Contracted recurring (estimated MRR/ARR) | Normalised active paid commercial commitment | `AccountSubscription` + plan period normalisation |
| Billed | Platform invoice totals in period | `PlatformInvoice` |
| Collected | Successful platform payments in period | `PlatformPayment` |
| Outstanding | Unpaid platform invoice balance | `PlatformInvoice.outstanding` / status |
| Credits / refunds / reversals | Commercial adjustments | `PlatformCredit`, `PlatformRefund` |

ARR = estimated MRR × 12 unless a stronger definition is certified later; always labelled approximate when derived.

### 5.2 Snapshot strategy

- Prefer extending Phase 4 `AnalyticsDailySnapshot` / `AnalyticsMonthlySnapshot` with documented `metricKey`s (e.g. `mrr_estimated_total`, `mrr_estimated_core`, `mrr_estimated_mra_eis`, per currency where needed).
- Dedicated MRR snapshot tables only if snapshot JSON/keys prove insufficient (decide in Wave 1 after Wave 0 matrix).
- Reconstruct job: idempotent, auditable, marks sparse periods UNAVAILABLE rather than forcing zeroes.
- Forward path: update snapshots when subscription lifecycle / payment events are consumed.

### 5.3 MRR bridge (when matrix allows)

Components: opening MRR, new, expansion, contraction, churned, reactivation, closing, net new.  
If prior-period snapshot or reconstruct confidence is insufficient → entire bridge (or affected components) **UNAVAILABLE**.

### 5.4 Explicitly deferred / UNAVAILABLE until verified

- Revenue by industry / region / country / acquisition source (unless attributes verified)
- CAC, predictive LTV, ML churn, AI commentary
- CRM opportunity forecasts
- Cross-currency consolidated totals without FX source
- Recognised revenue (GAAP) unless a certified recognition model exists (default: out of scope)

---

## 6. Services & APIs

### 6.1 Library layout

`lib/admin/revenue/` (new), reusing:

- `lib/admin/intelligence/metricStates.js` — envelopes
- `lib/admin/saasBillingKpis.js` — point-in-time estimated MRR baseline
- `lib/admin/analytics/*` — outbox, facts, snapshots, reconcile
- `lib/admin/authorization/*` — default-deny decisions

Modules (Wave 1+): catalogue, reconstruct, snapshots, bridge, billingAnalytics, collections, cohorts, forecast, reconciliation, pack builders.

### 6.2 HTTP API (server-authoritative)

Under `/api/admin/intelligence/revenue/`:

| Route family | Role |
|--------------|------|
| `overview` | Pack of READY* headline metrics + freshness/recon badges |
| `recurring` / `mrr` / `arr` / `movements` | Contracted recurring + bridge |
| `billing` / `collections` / `receivables` / `payment-performance` | Cash & AR analytics |
| `credits-refunds` | Adjustments |
| `mra-eis` | EIS commercial split (not fiscal EISInvoice) |
| `customers` / `segments` / `concentration` | Contribution (verified dims only) |
| `cohorts` / `retention` | Where reconstruct/snapshots allow |
| `forecast` | Deterministic contracted / renewal exposure only |
| `reconciliation` | Source vs analytics vs snapshot checks |
| `export` | CSV/XLSX/PDF foundation + audit |
| `definitions` | Catalogue read model for UI |

Optional thin `?section=` on overview for section pages (same pattern as Phase 5).

### 6.3 AuthZ

- Activate `systemAdmin.intel.revenue.read` (and related keys as needed: export, settings).
- Finance field projection / masking via existing `dashboard.financialMetrics` / `ALLOW_MASKED` patterns.
- Platform Auditor: read-only; exports audited.
- Nav: `/insightbooks/intelligence/revenue` mapped in `NAV_PERMISSION_MAP`; Intelligence nav group extended.

---

## 7. UI routes

Canonical entry: `/insightbooks/intelligence/revenue` → `/overview`.

Supporting routes (section pages; matrix-gated content):

- overview, recurring, mrr, arr, movements  
- retention, cohorts, subscriptions, plans  
- billing, collections, receivables, payment-performance, credits-refunds  
- mra-eis, customers, segments, concentration  
- forecast, reconciliation, reports, definitions, settings  

Shared: Phase 2 Admin shell components, date range, MetricCard envelopes, en/ny, a11y, responsive layouts.  
Executive Phase 5 soft-links into Revenue for drill-down; **one calculation path** for shared metrics.

---

## 8. Implementation waves (after Wave 0)

| Wave | Deliverable |
|------|-------------|
| **0** | Audit pack + readiness matrix + Phase 5 handoff (docs only) |
| **1** | Revenue catalogue; reconstruct + MRR snapshots; bridge/NRR/GRR where READY*; core APIs; unit tests |
| **2** | Workbench shell + overview + recurring/MRR/ARR/movements UI + nav + i18n |
| **3** | Billing, collections, ageing, payment performance, credits/refunds, MRA EIS commercial |
| **4** | Cohorts/retention, concentration, deterministic forecast, recon workbench, reports/export, definitions/settings; Phase 5 soft-link; close report |

Each wave ends with: no false-zero tests, permission denial tests, CoA still removed, no Tenant Sale in revenue packs.

---

## 9. Non-goals

- Tenant accounting revenue reports, tenant P&L, tenant GL  
- Tenant sales analytics as platform revenue  
- Complete customer health scoring; predictive churn ML  
- CRM leads/pipeline/proposals; sales forecasts from CRM  
- Marketing attribution implementation  
- CAC unless verified cost data exists  
- Predictive LTV without approved methodology  
- AI-generated commentary or recommendations  

---

## 10. Success criteria

- Same API returns role-filtered, currency-safe metric envelopes.
- Failed/missing/unreconstructable sources never render as zero.
- Every READY metric exposes definition, version, source, freshness, recon status.
- CORE and MRA EIS splits appear wherever product is known; combined total is labelled estimated contracted recurring.
- Bridge components absent when history confidence fails → UNAVAILABLE with reason.
- en/ny + responsive + accessible workbench sections for implemented waves.
- Critical/High gaps from Wave 0 register closed or explicitly deferred with UNAVAILABLE UI.

---

## 11. Spec self-review

| Check | Result |
|-------|--------|
| Placeholders / TBD | None material; Wave 1 may choose snapshot table vs metricKey after matrix |
| Contradictions | None vs locked decisions |
| Ambiguity | FX rate source not chosen yet — correctly gated as UNAVAILABLE until documented |
| Scope | Full route tree is UI shell ambition; engines gated by matrix (not all metrics in Wave 1) |
| Overbuild | Forecast limited to deterministic contracted/renewal exposure; no ML |

---

## 12. Approval

- Conversational design: **approved** 2026-07-28  
- Written spec: **approved** 2026-07-28  
- Wave 0 audit pack: **complete** under `docs/admin-intelligence-crm/phase-06/`
