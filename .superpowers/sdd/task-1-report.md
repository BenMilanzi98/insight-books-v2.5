# Task 1 Report — Phase 17 Wave 1 (Request + Project spine)

**Status:** DONE  
**Date:** 2026-07-31  
**Working tree:** branch `v2`, in-place (**no git commit**)  
**Domain path:** `lib/admin/customerSuccess/onboarding/**`

## Summary

Wave 1 Customer Onboarding spine shipped: Phase 16 ONBOARDING handoff → idempotent `ONR-` Request → validate/accept → `ONB-` Project with pinned ACTIVE STANDARD `templateVersionId`. Exact retries return the same row; conflicting idempotency fails visibly; invalid status transitions throw; missing Customer/Tenant/Subscription pins fail validation. No workstream materialisation, Tenant GL, Training completion, or fabricated onboarding complete.

## TDD evidence

### RED

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js

 FAIL  test/systemAdmin.cs.onboardingWave1.test.js
Error: Cannot find package '@/lib/admin/customerSuccess/onboarding'
```

Failure reason: module missing (expected before implementation).

### GREEN

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### Cases covered

| Case | Result |
|------|--------|
| Phase 16 handoff consume → one `ONR-` Request | PASS |
| Exact handoff retry → same Request | PASS |
| Accept → convert → one `ONB-` Project; second convert same | PASS |
| Exact project create retry → same Project | PASS |
| Conflicting idempotency payload → fail | PASS |
| Invalid status transition → throws `invalid_status_transition` | PASS |
| Request missing Customer/Tenant/Subscription → validation fail | PASS |

## Deliverables

### Lib (`lib/admin/customerSuccess/onboarding/`)

- `catalogue.js` — sources, statuses, types, domain contract, number regex
- `numbering.js` — `ONR` / `ONB` via `allocateCrmNumber` + `CrmNumberSeq` CAS
- `model.js` — `hasCustomerOnboarding*Model` guards + serializers
- `status.js` — Request/Project transition maps; **invalid → throw**
- `requests.js` — create / validate / accept / reject
- `projects.js` — create with template pin + idempotency/conflict
- `handoffConsume.js` — `consumeOnboardingHandoff` + typed `IN_PROGRESS` acknowledge (never COMPLETED)
- `templates.js` — `ensureWave1StandardTemplateVersion` (ACTIVE STANDARD seed)
- `index.js` — public exports

### Prisma / SQL

- Models appended to `prisma/schema.prisma`:
  - `CustomerOnboardingTemplateVersion`
  - `CustomerOnboardingRequest` + `CustomerOnboardingRequestStatusHistory`
  - `CustomerOnboardingProject` + `CustomerOnboardingProjectStatusHistory`
- SQL fallback: `scripts/sql/cs-onboarding-phase17-wave1.sql` (tables + STANDARD_WAVE1 ACTIVE seed)
- `CRM_NUMBER_PREFIX.ONR` / `ONB` added in `lib/admin/crm/catalogue.js`

### Thin API / UI

- `app/api/admin/customer-success/onboarding-requests/route.js` — list / consume / validate / accept / reject
- `app/api/admin/customer-success/onboarding/route.js` — list / create project / seed template
- UI stubs under `app/insightbooks/customer-success/onboarding/**` (hub, requests, projects)
- Route permissions for `/onboarding/requests` and `/onboarding/projects`

## Constraints honored

- [x] Consume Phase 16 ONBOARDING handoff only (wrong type rejected)
- [x] Never fabricate onboarding complete; handoff execution → `IN_PROGRESS` only via typed update
- [x] Exact retry same idempotency key → same Request/Project
- [x] Conflicting payload → `idempotency_conflict`
- [x] One Request → at most one Project (`CONVERTED_TO_PROJECT`)
- [x] Project requires ACTIVE `templateVersionId` (Wave-1 STANDARD seed)
- [x] No Workstream materialisation beyond deferred stub content
- [x] No Tenant GL / accounting posts
- [x] No Training completion
- [x] No git commit

## Self-review

| Check | Notes |
|-------|--------|
| Domain isolation | Spine under `customerSuccess/onboarding/*`; foundations UI replaced by thin hub stub |
| Handoff contract | Uses `handoffShared` / `CrmConversionDomainHandoff`; does not invent COMPLETED |
| Model guards | `hasCustomerOnboarding*Model` for Prisma EPERM / SQL-only path |
| Numbering | Reuses CRM CAS with new prefixes |
| Status machines | Request + Project maps; no `IN_PROGRESS` → `COMPLETED` skip |

## Concerns / follow-ups

1. **Prisma generate** — schema models added; Windows EPERM may still block `prisma generate`. Prefer SQL fallback until generate succeeds.
2. **Dedicated onboarding permissions** — Wave 1 reuses `customerSuccess.read` / `manageCases`. G17-08 may want `onboarding*` keys later.
3. **Handoff pin completeness** — consume allows incomplete pins; validate gate requires Customer+Tenant+Subscription. Upstream Phase 16 payload should carry all three for production handoffs.
4. **SDD review gate** before Wave 2 (templates/materialisation/kick-off).

## Commits

**None** (per brief).

## Fix wave

**Date:** 2026-07-31  
**Scope:** Important review findings only (handoff ack repair + Request convert repair). No git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>".

### Findings fixed

1. **Handoff consume idempotent replay** (`handoffConsume.js`) — Always call typed `acknowledgeOnboardingHandoffInProgress` after Request exists (create or replay). Failed first ack no longer leaves handoff stuck at `NOT_STARTED`. Never sets handoff `COMPLETED` / fabricated onboarding complete.
2. **Project create retry / race** (`projects.js`) — After Project exists (exact key, by `onboardingRequestId`, create success, or race catch), repair Request to `CONVERTED_TO_PROJECT` via `ensureRequestConvertedToProject`. Race catch resolves by idempotency key **or** `onboardingRequestId`.

### Tests added

- Replay consume repairs handoff to `IN_PROGRESS` when Request exists and handoff still `NOT_STARTED`
- Project create retry repairs Request to `CONVERTED_TO_PROJECT` when Project already exists

### Verification

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  03:19:18
   Duration  1.13s
```

| Case | Result |
|------|--------|
| Prior Wave 1 cases (7) | PASS |
| Replay consume repairs handoff `NOT_STARTED` → `IN_PROGRESS` | PASS |
| Project create retry repairs Request → `CONVERTED_TO_PROJECT` | PASS |

### Files changed

- `lib/admin/customerSuccess/onboarding/handoffConsume.js`
- `lib/admin/customerSuccess/onboarding/projects.js`
- `test/systemAdmin.cs.onboardingWave1.test.js`

