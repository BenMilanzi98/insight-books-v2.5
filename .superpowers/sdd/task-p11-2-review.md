# Task P11-2 Review — Wave 2 capture + handoffs + duplicates (re-review after fix pass)

**Scope:** Phase 11 Task 2 only (brief / report / WORKING_TREE)  
**Mode:** Read-only spec + quality review  
**Date:** 2026-07-30  
**Prior review:** Needs fixes (2× P2, 2× P3)  
**Vitest (re-run):** 3 files, 27 tests passed

## Fix-pass verification

### [P2] Client `sourceIdempotencyKey` ignored — **Resolved**

| Location | Evidence |
|----------|----------|
| `lib/admin/crm/capture.js:77-93` | `buildIdempotencyKey` derives `crm-capture:${sourceCode}:…` from normalized email/phone or handoff ref only; no client override parameter. |
| `lib/admin/crm/capture.js:292-299` | `captureLead` always calls `buildIdempotencyKey`; comment documents client keys ignored. |
| `lib/admin/crm/publicFormApi.js:20-33` | Public POST helper does not forward `sourceIdempotencyKey` / `idempotencyKey`. |
| `app/api/contact/demo-request/route.js:33-46` | Demo wire does not forward client idempotency keys. |
| `app/api/request-demo/route.js` (and start-trial / sales-enquiry) | Delegate to `handlePublicCapturePost` — no client key path. |
| `test/systemAdmin.crm.capture.test.js:396-427` | Two client-minted keys for same email+source → one Lead; stored key is server-derived. |

### [P2] Idempotent replay before throttle — **Resolved**

| Location | Evidence |
|----------|----------|
| `lib/admin/crm/capture.js:301-338` | `loadExistingByKey` runs first; existing Lead returns `{ idempotent: true }` without hitting throttle. |
| `lib/admin/crm/capture.js:340-341` | `checkThrottle` only runs for net-new captures. |
| `test/systemAdmin.crm.capture.test.js:429-478` | After throttle bucket exhausted, exact replay of first payload succeeds with `idempotent: true`. |

### [P3] `SOURCE_IDENTITY` duplicate match — **Resolved**

| Location | Evidence |
|----------|----------|
| `lib/admin/crm/duplicates.js:147-165` | Emits `SOURCE_IDENTITY` when same `sourceCode` and overlapping normalized email/phone across distinct leads. |
| `lib/admin/crm/capture.js:464-469` | Passes `sourceCode` into `detectDuplicateCandidates`. |
| `test/systemAdmin.crm.duplicates.test.js:271-278` | Duplicate store match types include `SOURCE_IDENTITY` in allowed set. |

### [P3] CRCRLF line endings — **Resolved**

Spot-check on `lib/admin/crm/capture.js`: no `\r\r\n` sequences. Report notes normalization applied to `capture.js`, `duplicates.js`, `handoffIntake.js`, `index.js`.

---

## Acceptance checklist

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Idempotent capture (exact retries → existing Lead) | **Met** | Server-derived key; replay before throttle; P2002 replay in `leads.js`; dedicated tests (exact key, client-key ignore, throttle+replay). |
| Distinct source codes per form/handoff | **Met** | `WEBSITE_CONTACT_FORM`, `REQUEST_DEMO`, `START_TRIAL`, `SALES_ENQUIRY`, `CUSTOMER_SUCCESS_HANDOFF`, `SUPPORT_HANDOFF`, `PRODUCT_SIGNAL`; channels `WEB_FORM` / `INTERNAL_HANDOFF`. |
| Email/WhatsApp marked NOT_AVAILABLE | **Met** | Catalogue + `captureLead` reject; tests assert `NOT_AVAILABLE`. |
| No auto-merge; duplicate candidates only | **Met** | Detect/list/review only; review sets status/reason/audit; no merge APIs. |
| Vitest PASS (+ Wave 1 CRM leads green) | **Met** | `npx vitest run` → 3 files / 27 tests passed. |

## Global constraints

| Constraint | Status |
|------------|--------|
| Lead ≠ Opportunity ≠ Customer ≠ Ticket ≠ CsCase | OK |
| Idempotent capture | OK — prior P2 gaps closed |
| No inferred consent | OK — default `UNKNOWN`; `GRANTED` only with explicit `consentPurposes[]` |
| No auto-merge | OK |
| Email/WhatsApp NOT_AVAILABLE | OK |
| No source mutation on handoff | OK — read-only handoff lookups |
| CoA removed / not reintroduced | OK |
| No commit | OK — WORKING_TREE |

## Spec coverage (brief)

Shared `capture.js` / `duplicates.js` / `handoffIntake.js`, catalogue/authz/index, Prisma + SQL fallback, demo-request wire, public pages/APIs, admin duplicates + handoff-intake routes, Vitest coverage, spam guards (size + honeypot + documented process-local throttle), Account/Contact suggest-only, no public owner: **present**.

## Overall assessment

Fix pass addresses all prior review findings. Public capture identity is server-authoritative; exact retries are not blocked by the process-local throttle; duplicate detection includes `SOURCE_IDENTITY`; line endings normalized. Wave 2 shape remains correct: idempotent capture, handoff link-only intake, duplicate candidates without merge, EMAIL/WHATSAPP deferred, green Vitest including Wave 1 leads regression.

**Residual risks (non-blocking, acknowledged in report):** process-local throttle is not multi-instance safe; synthetic `@crm.internal` handoff emails are identity-only; domain `endsWith` duplicate path is weak in mocks.

**Task quality:** Approved
