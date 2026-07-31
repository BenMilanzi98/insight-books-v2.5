# Task P9-1 Review — Wave 1 Catalogue + reliability gate + commerce producers

**Verdict: Spec Compliance Approved | Task quality Approved**

Re-review after Important #1 / #2 fixes. EIS offline + reconcile accept paths now emit (idempotent on `transmissionId`); invoice producer fails closed without posted-status evidence. Gate `AVAILABLE` for `eis.fiscal.accept` is consistent with covered accept surfaces. Vitest **22/22** passed.

**Reviewer:** read-only against brief, report, producers, reliability gate, EIS call sites, and tests.

---

## Spec Compliance

| Area | Status | Notes |
|------|--------|-------|
| Repo-backed catalogue (`listProductModules`, features, cadence, lifecycle) | **Met** | Modules include invoices/sales/eis; Wave 1 trio + `payroll.run` shell |
| `resolveFeatureEntitlement` observe-only | **Met** | No mutations; UNKNOWN / INCLUDED / override / MRA add-on paths |
| `emitProductMeaningfulAction` + typed commerce events | **Met** | Rejects `FEATURE_USED` / scaffold / uninstrumented; Phase 4 outbox only |
| Idempotent producers (invoice / POS / MRA) | **Met** | Keys `evt:<EVENT>:<sourceId>`; reject/retry/reprint skips in producer |
| Call-site wiring (prefer real paths) | **Met** | Invoice create + Draft→post; POS create + draft→completed; online accept; **offline** via `transitionTransmissionStatus`; **reconcile** via `reconciliationOrchestrator` |
| `evaluateProductReliability` — never false zero | **Met** | Failures → `value: null` + status; AVAILABLE uses `undefined` (not `0`) |
| Uninstrumented → `NOT_INSTRUMENTED` | **Met** | `payroll.run` covered |
| No parallel event store / no UI / no commit | **Met** | Reuses AnalyticsOutbox; UI deferred |
| Payload hygiene (no GL lines / MRA credentials) | **Met** | Allowlist sanitize + tests |
| Permissions `intel.productAnalytics.*` + NAV stubs | **Met** | Present; broader permissions catch-up still coexists in tree (merge follow-up) |

**Overall:** Compliant with Wave 1 brief and matrices for the instrumented commerce trio.

---

## Verification (prior Important findings)

### 1. EIS offline / reconcile accept emit — **Fixed**

| Path | Evidence |
|------|----------|
| Offline / shared accepted transition | `transmissionService.transitionTransmissionStatus` emits when `nextStatus` ∈ `ACCEPTED_ONLINE` \| `ACCEPTED_OFFLINE` \| `RECONCILED_ACCEPTED` |
| Reconcile acceptance recovery | `reconciliationOrchestrator` emits after update to `RECONCILED_ACCEPTED` |
| Online | `transmissionOrchestrator` unchanged; still emits on first accepted online outcome |
| Idempotency | All use `evt:MRA_EIS_TRANSACTION_ACCEPTED:<transmissionId>` — online→reconcile / double transition collapses |
| Gate honesty | `eis.fiscal.accept` remains INSTRUMENTED / gate `AVAILABLE` with accept-path coverage |

Tests: producer offline + reconcile outcomes; `transitionTransmissionStatus` → `ACCEPTED_OFFLINE` call-site; shared-key idempotency.

**Residual (non-blocking):** `transitionTransmissionStatus` is the only in-repo writer of `ACCEPTED_OFFLINE` today (exported public helper; no other offline orchestrator writer found). Wiring there is the correct hook. Reconcile emit is on the live orchestrator path; there is no direct orchestrator integration test (producer + shared-key coverage only).

### 2. Invoice emit fail-closed without posted status — **Fixed**

`emitSalesInvoicePosted` now:

- omit / null / blank → skip `status_required`
- `Draft` / `PROFORMA` / `UNKNOWN` → skip `not_posted`
- only then appends outbox

Call sites still pass `status` from the invoice row and pre-gate Draft/PROFORMA. Tests cover omit / UNKNOWN / Draft.

---

## Findings

### Critical

_None._

### Important

_None remaining for Spec Compliance of P9-1 analytics surfaces._

### Minor / follow-up

1. **Merge isolation still recommended** — Unrelated accountingV2 / EIS bridge / broad permissions churn may still share the working tree with P9-1. Isolate before merge; not a producer/gate correctness defect.

2. **`resolveProductAnalyticsAccess` comment vs code** — Comment mentions `dashboard.view` break-glass; `canView` is `productAnalytics.read` OR `product.read` only. Align comment (or grant) when convenient.

3. **MRA call sites hardcode `isRetry: false` / `isReprint: false`** — Safe with early-return + idempotency; derive from attempt metadata if those flags become authoritative later.

4. **Entitlement plan matching remains heuristic** — Observe-only Wave 1; can over-state `INCLUDED` until plan codes align.

---

## What looks solid

- Strict events: `FEATURE_USED` scaffold-only; verified commerce emitters; producers via `appendAnalyticsOutbox`.
- Invoice/POS/MRA exclusions and allowlisted payloads.
- Reliability gate never returns numeric zero on failure; `payroll.run` → `NOT_INSTRUMENTED`.
- Interfaces from the brief exported and covered; **22** vitest tests green.
- No UI; no git commit; no parallel event store.

---

## Task quality

**Approved**

Important #1 (EIS coverage vs AVAILABLE) and #2 (invoice fail-closed) are addressed in code and tests. Residual merge isolation and minor comment/heuristic items are follow-ups, not reopen blockers for Wave 1 Spec Compliance.

**Retest observed:**  
`npx vitest run test/systemAdmin.productAnalytics.catalogue.test.js test/systemAdmin.productAnalytics.producers.test.js` → **22 passed (22)**.
