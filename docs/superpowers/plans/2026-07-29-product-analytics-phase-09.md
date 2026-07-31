# Product Analytics Phase 9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/intelligence/product-analytics` with repo-backed taxonomy, Phase 4 event plane producers (commerce core first), and honest `NOT_INSTRUMENTED` for everything without server-verified events.

**Architecture:** Wave 0 matrices → dual `lib/admin/productCatalogue/*` + `lib/admin/productAnalytics/*` → commerce producers into Phase 4 outbox → first-value/adoption engines for instrumented features → UI → funnels/signals/Phase 10 pack.

**Tech Stack:** Next.js, Prisma, Vitest, Phase 4 analytics plane, metric envelopes, en/ny, portfolio scope.

**Spec:** [docs/superpowers/specs/2026-07-29-product-analytics-phase-09-design.md](../specs/2026-07-29-product-analytics-phase-09-design.md)

## Global Constraints

- Strict events only — domain tables are candidates; live metrics NOT_INSTRUMENTED until producers exist.
- Page views / login alone ≠ value / activation / adoption.
- Retries / reprints / workers ≠ new usage; association ≠ causation.
- Never Tenant Sale; CoA admin route stays removed; no invasive tracking.
- Repo-backed catalogue; PRD extras NOT_APPLICABLE.
- Commits only when user asks.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-09/*`

- [x] Validate Phase 8 READY_FOR_PHASE_9_WITH_BLOCKERS + FEATURE_USED blocker
- [x] CURRENT_* audits + matrices + gap register + IMPLEMENTATION_PLAN
- [x] CONDITIONAL GO for Wave 1 (catalogue + commerce producers; broad metrics blocked)
- [x] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — Catalogue + reliability gate + commerce producers

**Files:**
- Create: `lib/admin/productCatalogue/*` (areas, modules, features, cadence, lifecycle, entitlements resolve)
- Create: `lib/admin/productAnalytics/reliabilityGate.js`, `authz.js`, `catalogue.js`
- Extend: `lib/admin/analytics/emit.js` + producers for Invoice posted, POS completed, MRA accepted (idempotent)
- Permissions: `intel.productAnalytics.*`
- Test: `test/systemAdmin.productAnalytics.catalogue.test.js`, `…producers.test.js`

**Interfaces:**
- `listProductModules() → ModuleDef[]`
- `resolveFeatureEntitlement(prisma, { tenantId, featureCode, asOf }) → { status, planVersion, limitations }`
- `emitProductMeaningfulAction(prisma, { eventCode, tenantId, featureCode, sourceType, sourceId, idempotencyKey, … })`
- `evaluateProductReliability(metricCode, ctx) → AVAILABLE | NOT_INSTRUMENTED | …`

- [ ] Failing tests: FEATURE_USED still scaffold until producers; invoice producer idempotent; gate returns NOT_INSTRUMENTED for uninstrumented feature
- [ ] Implement catalogue + 3 commerce producers + gate
- [ ] Vitest PASS

---

### Task 2: Wave 2 — First-value / activation / adoption (instrumented only)

**Files:** `lib/admin/productAnalytics/{firstValue,repeatValue,activation,adoption,facts}.js` + APIs + tests

- [ ] First value unique per feature scope; retries/reprints excluded
- [ ] Adoption states for instrumented features only; others NOT_INSTRUMENTED
- [ ] Vitest PASS

---

### Task 3: Wave 3 — Workbench UI + nav + i18n

**Files:** pages under `app/insightbooks/intelligence/product-analytics/**`, `productAnalyticsNav.js`, components, locales, NAV map

- [ ] Overview shows instrumented commerce metrics + UNAVAILABLE elsewhere
- [ ] Nav permission map complete; vitest nav PASS

---

### Task 4: Wave 4 — Funnels/cohorts/signals/recon/export + Phase 10 pack

**Files:** funnels, cohorts, signals, recon, export; docs `FINAL_PHASE_09_REPORT.md`, `PHASE_10_INPUTS.md`

- [ ] Funnels only for instrumented features
- [ ] Signals deterministic; no invented probability/revenue
- [ ] Exit READY_FOR_PHASE_10_WITH_BLOCKERS
- [ ] Related vitest PASS

---

## Plan self-review

Spec waves map to Tasks 0–4. No TBD blocking Wave 0. Commits optional per user rule.
