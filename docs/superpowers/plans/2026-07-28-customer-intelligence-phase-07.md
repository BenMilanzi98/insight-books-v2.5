# Customer Intelligence Phase 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/intelligence/customers` Customer Intelligence Workbench with Tenant=Customer 360, portfolios, deterministic signals, and honest UNAVAILABLE for uninstrumented adoption/DAU/support.

**Architecture:** Wave 0 matrix → `lib/admin/customers/*` + APIs → UI. Reuse Phase 6 commercial; login engagement proxies; no opaque health.

**Tech Stack:** Next.js, Prisma, Vitest, Admin shell, metric envelopes, en/ny.

**Spec:** [docs/superpowers/specs/2026-07-28-customer-intelligence-phase-07-design.md](../specs/2026-07-28-customer-intelligence-phase-07-design.md)

## Global Constraints

- Tenant = canonical Customer; never Tenant Sale as commercial truth.
- No false zeroes; no opaque health score; no ML churn.
- No CS cases/playbooks in Phase 7.
- Portfolio-scoped agents; no cross-tenant leakage.
- Adoption/DAU/FEATURE_USED UNAVAILABLE until instrumented.
- Commits only when user asks.

---

### Task 0: Wave 0 — Handoff + forensic audit pack

**Files:** Create Phase 6 handoff + `docs/admin-intelligence-crm/phase-07/*` listed in design §4.

- [ ] Write `PHASE_07_INPUTS.md` + readiness checklist under phase-06
- [ ] Write phase-07 audits + `CUSTOMER_SOURCE_READINESS_MATRIX.md` + gap register
- [ ] Record CONDITIONAL GO for Wave 1 (identity/commercial ready; adoption blocked)
- [ ] Point IMPLEMENTATION_PLAN at this file
- [ ] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — 360 + lifecycle + directory APIs

**Files:**
- `lib/admin/customers/*` (identity, hierarchy, lifecycle, customer360, index)
- `app/api/admin/intelligence/customers/overview|directory|[tenantId]/route.js`
- Permissions `intel.customers.*` + NAV map
- `test/systemAdmin.customer360.test.js`

**Interfaces:**
- `buildCustomer360(prisma, { admin, tenantId }) → { forbidden?, sections, reliability }`
- `listCustomerDirectory(prisma, { admin, filters, page }) → paged rows`
- Lifecycle: `resolveLifecycleStage(tenant, subscription, opts) → { stage, ruleVersion, limitations }`

- [ ] Failing tests: forbidden, partial engagement, commercial no Sale, missing tenant 404
- [ ] Implement 360 + directory + overview pack
- [ ] `npx vitest run test/systemAdmin.customer360.test.js` PASS

---

### Task 2: Wave 2 — Workbench UI

**Files:**
- `lib/admin/customerNav.js`, `components/admin/customers/*`
- Pages under `app/insightbooks/intelligence/customers/**`
- adminNav + locales en/ny

- [ ] Overview + directory + detail tabs
- [ ] UNAVAILABLE for adoption/support
- [ ] Nav permission map complete; vitest nav PASS

---

### Task 3: Wave 3 — Portfolios, ownership, segments

**Files:**
- Prisma models CustomerPortfolio, CustomerOwnership (+ Segment if needed)
- APIs portfolios/segments; scope helper `assertTenantInPortfolio`
- UI portfolio + owner assignment
- Tests portfolio isolation

- [ ] Agent without portfolio cannot read foreign tenant 360
- [ ] Unassigned queue

---

### Task 4: Wave 4 — Signals, recon, export, Phase 8 pack

**Files:**
- `lib/admin/customers/signals.js`, reconciliation, export
- Attention queues UI
- `docs/.../phase-07/FINAL_PHASE_07_REPORT.md`, `PHASE_08_INPUTS.md`

- [x] Deterministic signals only; no probability
- [x] Export JSON/CSV foundation
- [x] Final readiness READY_FOR_PHASE_8_WITH_BLOCKERS if adoption still missing
- [x] Full related vitest PASS

---

## Plan self-review

Spec sections map to Tasks 0–4. No TBD. Commits optional per user rule.
