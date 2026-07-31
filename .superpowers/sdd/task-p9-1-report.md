# Task P9-1 Report — Wave 1 Catalogue + reliability gate + commerce producers

**Status:** DONE  
**Date:** 2026-07-29  
**Catalogue version:** `product-catalogue-2026-07-29` / `product-analytics-2026-07-29`  
**Commits:** none — commit deferred  

## Summary

Implemented Phase 9 Wave 1: repo-backed product catalogue, product analytics reliability gate + authz, three idempotent commerce producers into the Phase 4 AnalyticsOutbox plane, `intel.productAnalytics.*` permissions with NAV stubs, and vitest coverage. `FEATURE_USED` remains scaffold-only.

## TDD evidence

### RED (failing tests first)

1. Created `test/systemAdmin.productAnalytics.catalogue.test.js` and `test/systemAdmin.productAnalytics.producers.test.js` before implementation.
2. Ran `npx vitest run test/systemAdmin.productAnalytics.catalogue.test.js test/systemAdmin.productAnalytics.producers.test.js`:
   - **FAIL** — `Cannot find package '@/lib/admin/productCatalogue'` / `@/lib/admin/productAnalytics` (0 tests collected).
3. Required behaviours encoded up front:
   - gate → `NOT_INSTRUMENTED` for uninstrumented feature (`payroll.run`)
   - invoice producer idempotent on source id
   - `FEATURE_USED` still not a free-for-all
   - catalogue lists repo modules including invoices / sales / eis

### GREEN

1. Implemented catalogue, gate, producers, analytics catalogue extensions, permissions, call-site wiring.
2. Final run: **`npx vitest run test/systemAdmin.productAnalytics.catalogue.test.js test/systemAdmin.productAnalytics.producers.test.js` → 18 passed (18)**.

## Files created / modified

### Created — productCatalogue

- `lib/admin/productCatalogue/areas.js`
- `lib/admin/productCatalogue/cadence.js`
- `lib/admin/productCatalogue/lifecycle.js`
- `lib/admin/productCatalogue/modules.js`
- `lib/admin/productCatalogue/features.js`
- `lib/admin/productCatalogue/entitlements.js`
- `lib/admin/productCatalogue/index.js`

### Created — productAnalytics

- `lib/admin/productAnalytics/catalogue.js`
- `lib/admin/productAnalytics/reliabilityGate.js`
- `lib/admin/productAnalytics/authz.js`
- `lib/admin/productAnalytics/producers.js`
- `lib/admin/productAnalytics/index.js`

### Created — tests / report

- `test/systemAdmin.productAnalytics.catalogue.test.js`
- `test/systemAdmin.productAnalytics.producers.test.js`
- `.superpowers/sdd/task-p9-1-report.md` (this file)

### Modified

- `lib/admin/analytics/catalogue.js` — add verified commerce event types; keep `FEATURE_USED` scaffold-only
- `lib/admin/analytics/emit.js` — re-export commerce producer helpers
- `lib/admin/permissions.js` — `intel.productAnalytics.*` + NAV map stubs for `/insightbooks/intelligence/product-analytics*`
- `app/api/invoices/route.js` — wire `emitSalesInvoicePosted` on non-draft create
- `app/api/invoices/[id]/route.js` — wire on Draft → posted transition
- `app/api/sales/route.js` — wire `emitPosTransactionCompleted` on completed create
- `app/api/sales/[id]/route.js` — wire on draft→completed update
- `lib/mraEis/application/salesTransmission/transmissionOrchestrator.js` — wire `emitMraEisTransactionAccepted` after accepted online outcome only

## Interfaces delivered

| Function | Behaviour |
|----------|-----------|
| `listProductModules()` | Repo-backed `ModuleDef[]` from MODULE_FEATURE_MATRIX |
| `listProductFeatures()` | Wave 1 instrumented trio + `payroll.run` shell |
| `resolveFeatureEntitlement(prisma, { tenantId, featureCode, asOf })` | `{ status, planVersion, limitations }` — observe only |
| `emitProductMeaningfulAction(prisma, …)` | Typed event only; rejects scaffold `FEATURE_USED` / uninstrumented features |
| `emitSalesInvoicePosted` / `emitPosTransactionCompleted` / `emitMraEisTransactionAccepted` | Idempotent outbox append; exclusions for draft / non-completed / reject / retry / reprint |
| `evaluateProductReliability(metricCode, ctx)` | `AVAILABLE` \| `NOT_INSTRUMENTED` \| `DEFINITION_MISSING` \| … — value `null` on failure |

### Feature / event codes (exact)

| Feature | Event | Source aggregate |
|---------|-------|------------------|
| `invoices.post` | `SALES_INVOICE_POSTED` | `Invoice` |
| `sales.pos.complete` | `POS_TRANSACTION_COMPLETED` | `Sale` |
| `eis.fiscal.accept` | `MRA_EIS_TRANSACTION_ACCEPTED` | `MraEisTransmission` |

Idempotency keys: `evt:<EVENT>:<sourceId>`.

## Call-site wiring

| Path | Wired? | Notes |
|------|--------|-------|
| `POST /api/invoices` non-draft | Yes | After commit, before EIS submit |
| `PUT/PATCH /api/invoices/[id]` Draft→posted | Yes | Same transition as EIS bridge |
| `POST /api/sales` status=completed | Yes | After commit |
| `PUT /api/sales/[id]` draft→completed | Yes | Only when prior status ≠ completed |
| `transmitFiscalSnapshotOnline` accepted | Yes | After outcome tx; skips `alreadyAccepted` early return |
| Offline accept via `transitionTransmissionStatus` → `ACCEPTED_OFFLINE` | Yes | Emit after accepted transition; same idempotency key / retry·reprint exclusions |
| Reconcile accept → `RECONCILED_ACCEPTED` | Yes | `reconciliationOrchestrator` after status update; idempotent on `transmissionId` |
| Receipt reprint / reject / retry | Excluded | Producer skips `accepted=false`, `isRetry`, `isReprint` |

## Schema / SQL

No new event store. Reuses Phase 4 `AnalyticsOutbox` / `AnalyticsEvent`. No Prisma migration required for Wave 1.

## Self-review

### Spec compliance

- [x] Strict events only — reliability gate returns `NOT_INSTRUMENTED` without producers
- [x] `FEATURE_USED` remains scaffold-only (not verified emitter)
- [x] Retries / reprints / rejects excluded from MRA accepted emit
- [x] Payloads: IDs/classifications only (no GL lines / MRA credentials)
- [x] Repo-backed catalogue; PRD extras not invented as instrumented
- [x] No UI pages (Task 3)
- [x] No git commit
- [x] Reuse Phase 4 outbox/emit — no parallel store

### Test matrix coverage

| Case | Result |
|------|--------|
| Catalogue lists invoices/sales/eis modules | PASS |
| Gate NOT_INSTRUMENTED for payroll.run | PASS |
| Gate AVAILABLE for invoices.post | PASS |
| Gate DEFINITION_MISSING for unknown feature | PASS |
| Permissions + NAV stubs | PASS |
| FEATURE_USED scaffold-only | PASS |
| Commerce events in VERIFIED_EMITTERS | PASS |
| Invoice producer idempotent | PASS |
| Invoice fail-closed omit/unknown status | PASS (post-review) |
| POS skip non-completed + idempotent | PASS |
| MRA skip reject/retry + idempotent | PASS |
| MRA offline + reconcile-accepted emit + idempotency | PASS (post-review) |
| `transitionTransmissionStatus` ACCEPTED_OFFLINE emits | PASS (post-review) |
| Entitlement UNKNOWN / INCLUDED | PASS |

## Concerns / follow-ups

1. ~~**Offline / reconcile-accepted EIS**~~ — **Fixed (review Important #1):** wired `emitMraEisTransactionAccepted` in `transitionTransmissionStatus` (covers `ACCEPTED_OFFLINE` / shared accepted transitions) and `reconciliationOrchestrator` (`RECONCILED_ACCEPTED`). Idempotent on `transmissionId`; same retry/reprint exclusions as online.
2. **Entitlement resolution** — best-effort against `PlatformFeatureEntitlement` + `AccountSubscription`/`PlatformPlanVersion` + MRA entitlement; plan feature string matching is heuristic until plan catalogue codes align with product feature codes.
3. **No fact consumer yet** for commerce events — Wave 2 first-value/adoption engines will consume; outbox rows are PENDING until dispatcher/consumers extended.
4. **UI / nav components** deferred to Task 3 (permission map stubs only).
5. **Out-of-scope dirty tree** (review Important #3) — not unbundled here; isolate accounting/permissions churn before merge separately.

---

## Review fixes (2026-07-29) — Important #1 + #2

**Source:** `task-p9-1-review.md` Important findings 1–2. No git commit. Did not unbundle unrelated accounting/permissions history.

### Changes

1. **`eis.fiscal.accept` reliability (prefer a)**
   - `lib/mraEis/application/services/transmissionService.js` — emit after accepted transitions (`ACCEPTED_ONLINE` / `ACCEPTED_OFFLINE` / `RECONCILED_ACCEPTED`) via shared helper path.
   - `lib/mraEis/application/reconciliation/reconciliationOrchestrator.js` — emit on acceptance recovery → `RECONCILED_ACCEPTED`.
   - Online orchestrator path unchanged; duplicate emits collapse via `evt:MRA_EIS_TRANSACTION_ACCEPTED:<transmissionId>`.
   - Gate remains `AVAILABLE` with full accept-path coverage (online + offline transition + reconcile).

2. **`emitSalesInvoicePosted` fail-closed**
   - `lib/admin/productAnalytics/producers.js` — omit / empty / `UNKNOWN` / `Draft` / `PROFORMA` → skip (`status_required` / `not_posted`); no emit without posted-status evidence.

### Tests

- Adjusted/added in `test/systemAdmin.productAnalytics.producers.test.js`.
- Retest: `npx vitest run test/systemAdmin.productAnalytics.catalogue.test.js test/systemAdmin.productAnalytics.producers.test.js` → **22 passed (22)**.
