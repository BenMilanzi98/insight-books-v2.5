# Customer Intelligence Phase 7 — Design

**Status:** Approved (conversation 2026-07-28); Wave 0 docs first  
**Date:** 2026-07-28  
**Primary surface:** `/insightbooks/intelligence/customers`  
**Architecture:** Approach B — Customer Intelligence domain + 360 read model

---

## 1. Purpose

Deliver a secure, source-traceable **Customer Intelligence Workbench** for InsightBooks platform customers (Tenants), covering identity, hierarchy, lifecycle, commercial relationship (Phase 6), engagement proxies, deterministic risk/opportunity signals, portfolios, and reconciliation — **without** opaque health scores, CS case/playbook workflows, or Tenant GL exposure.

Phase 8 (Customer Health / CS operations) consumes this phase’s 360 contract, signals, and portfolios.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Sequencing | **Wave 0 first** — audits + readiness matrix before engines/UI |
| Architecture | **Customer Intelligence domain** + rebuildable 360 read model |
| Canonical customer | **Tenant** = Customer; Business/Branch/User are hierarchy nodes (no separate Business model today) |
| Portfolios | **Introduce** portfolio + ownership models in Phase 7 |
| Engagement | **Honest partial** — `USER_LOGIN` / `lastLogin` + user counts with limitations |
| Adoption / DAU / feature breadth | **UNAVAILABLE** until `FEATURE_USED` / unique-user facts exist |
| Support / onboarding / training | Authoritative only; else **Not instrumented** |
| Health score | **None** — separate signals only |
| Commercial | Platform billing / Phase 6 only — never Tenant Sale |
| Currency | Per Phase 6 FX policy — no silent consolidation |

---

## 3. Hard rules

- Verified / reconciled data only; no false zeroes; no fake activity.
- No client-side authoritative aggregation.
- No opaque health / ML churn / AI narratives.
- No CS cases, playbooks, full onboarding/training/support reimplementation.
- No CRM leads/pipeline.
- No Tenant accounting exposure.
- No cross-tenant / cross-business leakage; portfolio-scoped agents.
- Meaningful activity excludes workers, refreshes, reprints, duplicate events.
- Page views ≠ adoption.
- Signals explainable (code, rule version, source, threshold, freshness).
- No silent customer merge on fuzzy name.

---

## 4. Wave 0 — Readiness (docs only)

### 4.1 Phase 6 → 7 handoff

Create under `docs/admin-intelligence-crm/phase-06/`:

- `PHASE_07_INPUTS.md`
- `PHASE_07_READINESS_CHECKLIST.md`
- Update / add readiness decision pointer if needed

### 4.2 Phase 7 audit pack (minimum viable, non-empty)

Under `docs/admin-intelligence-crm/phase-07/`:

| Doc | Purpose |
|-----|---------|
| `README.md` | Index |
| `PHASE_07_SCOPE.md` | In / out |
| `PHASE_INPUT_VALIDATION.md` | What Phases 1–6 actually provide |
| `CURRENT_CUSTOMER_INTELLIGENCE_AUDIT.md` | Existing tenant/revenue surfaces |
| `CURRENT_CUSTOMER_IDENTITY_AUDIT.md` | Tenant as customer |
| `CURRENT_TENANT_HIERARCHY_AUDIT.md` | Branch/User |
| `CURRENT_ENGAGEMENT_AUDIT.md` | Login facts vs DAU |
| `CURRENT_ADOPTION_AUDIT.md` | FEATURE_USED gap |
| `CURRENT_COMMERCIAL_SUMMARY_AUDIT.md` | Phase 6 reuse |
| `CURRENT_SUPPORT_SUMMARY_AUDIT.md` | No SupportTicket |
| `CURRENT_PORTFOLIO_AUDIT.md` | Missing models |
| `CUSTOMER_SOURCE_READINESS_MATRIX.md` | Per-field READY* / UNAVAILABLE |
| `PHASE_07_GAP_REGISTER.md` | Gaps |
| `IMPLEMENTATION_PLAN.md` | Pointer to superpowers plan |
| `CANONICAL_CUSTOMER_DEFINITION.md` | Tenant = Customer |
| `CUSTOMER_360_RESPONSE_CONTRACT.md` | Typed 360 contract |

**Gate:** No numeric card for UNAVAILABLE / NOT_SUPPORTED sources.

---

## 5. Domain architecture

```text
Tenant (+ Branch, User, AccountSubscription, Platform*, MraEisTenantEntitlement)
        → identity resolution (review matches; no fuzzy auto-merge)
        → Customer 360 read model (section-partial OK)
        → lifecycle stage rules (versioned)
        → segments (static / dynamic / system)
        → portfolios + ownership (primary CS owner)
        → deterministic risk / opportunity signals
        → attention queues
        → directory + detail UI + export foundation
```

### 5.1 Customer 360 sections

| Section | Source posture |
|---------|----------------|
| Identity | Tenant fields — READY |
| Hierarchy | Branch/User counts — READY |
| Commercial | Phase 6 / Platform* / subs — READY_WITH_LIMITATIONS |
| Engagement | Login proxies — READY_WITH_LIMITATIONS |
| Adoption | UNAVAILABLE (FEATURE_USED) |
| MRA EIS | Entitlement + commercial plan — READY_WITH_LIMITATIONS |
| Service (support/onboarding/training) | NOT_INSTRUMENTED unless models found |
| Signals | Deterministic from verified dims only |
| Reliability | Freshness / recon / limitations |

### 5.2 Lifecycle (versioned rules)

Stages such as: CREATED, TRIAL, ACTIVE_PAID, PAYMENT_DELINQUENT, SUSPENDED, CANCELLATION_SCHEDULED, CHURNED, REACTIVATED, ARCHIVED — derived from Tenant.status + subscription + payment signals; incomplete legacy → limitation, not invented stage.

### 5.3 Portfolios

- `CustomerPortfolio` + `CustomerOwnership` (names may match Prisma conventions)
- Types: CUSTOMER_SUCCESS (primary), others as needed
- Agent scope: assigned portfolio Tenants only
- History retained; reassignment requires reason

### 5.4 Signals (examples when sources exist)

Risk: NO_MEANINGFUL_ACTIVITY (login-based), RENEWAL_DUE_SOON, HIGH_OUTSTANDING_BALANCE, SUBSCRIPTION_SUSPENDED, MRA_EIS_ENTITLEMENT_PENDING, CUSTOMER_OWNER_MISSING  
Opportunity: USER_LIMIT only if limit source verified; MRA_EIS_ELIGIBLE if rules verified  
**Never:** probability, expected revenue, opaque score

---

## 6. Services & APIs

`lib/admin/customers/` — identity, hierarchy, lifecycle, customer360, segments, portfolios, signals, reconciliation, pack builders  

Reuse: `metricStates`, Phase 6 revenue helpers, `authorizeAdminDecision`, analytics facts  

HTTP under `/api/admin/intelligence/customers/`:

- overview, directory, `[tenantId]` (360), lifecycle, engagement, commercial, renewals, mra-eis, signals, portfolios, segments, reconciliation, export, definitions  

Auth: `systemAdmin.intel.customers.*` (+ portfolio scope); finance fields via existing finance / revenue patterns.

---

## 7. UI routes

- `/insightbooks/intelligence/customers` → overview  
- Supporting section routes per master prompt  
- Detail: `/insightbooks/intelligence/customers/[tenantId]` with tabs (overview, hierarchy, commercial, engagement, mra-eis, signals, …) — adoption/support tabs show UNAVAILABLE honestly  
- Nav under Intelligence; en/ny; Phase 2 components; MetricCard envelopes  

---

## 8. Waves after Wave 0

| Wave | Deliverable |
|------|-------------|
| **0** | Audit pack + matrix + Phase 6 handoff |
| **1** | Catalogue, 360 builder, lifecycle, directory API, unit tests |
| **2** | Workbench UI + detail tabs + i18n |
| **3** | Portfolios, ownership, segments, attention queues |
| **4** | Signals engine, recon, reports/export foundation, Phase 8 inputs, final report |

---

## 9. Non-goals

Opaque health; ML churn; CS cases/playbooks; full CRM; inventing adoption/support/onboarding; Tenant Sale as commercial truth; silent merges.

---

## 10. Success criteria

- One canonical Customer = Tenant definition documented and enforced  
- 360 returns role-scoped sections; failed sections UNAVAILABLE not zero  
- Portfolio agents cannot access unassigned Tenants  
- Commercial from platform sources only  
- No health score introduced  
- Phase 8 input package produced  
- Readiness: **READY_FOR_PHASE_8_WITH_BLOCKERS** expected if adoption/support still unavailable  

---

## 11. Spec self-review

| Check | Result |
|-------|--------|
| Placeholders | Wave 1 Prisma model names may follow repo naming; semantics locked |
| Contradictions | None vs locked decisions |
| Scope | Full route tree is wave-gated; UNAVAILABLE for missing instrumentation |
| Overbuild | No CS workflows / health engine |

---

## 12. Approval

- Conversational design: **approved** 2026-07-28  
- Written spec: this file  
- Wave 0: first execution deliverable  
