# Business Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hybrid full-page Business Setup Wizard that orchestrates draft openings and posts **one consolidated Opening Journal** via Accounting V2 (`AcctV2OpeningBalanceBatch` + Posting Engine), with policy-driven SoD and controlled conversion for existing businesses.

**Architecture:** `BusinessSetupRun` is the aggregate; domain modules supply draft data; a line compiler builds one balanced journal payload; existing V2 opening-balance batch posts it. Dashboard checklist launches `/setup`. Soft login remains non-blocking.

**Tech Stack:** Next.js App Router, React, Prisma/PostgreSQL, Vitest, existing `lib/accountingV2/*`, Decimal money helpers.

**Approved forks:** A3 (hybrid UI) · B1 (one journal) · C2 (policy SoD) · D2 (conversion mode)

**Spec:** `docs/superpowers/specs/2026-07-22-business-setup-wizard-design.md`

## Global Constraints

- Post openings only through `executePosting` / V2 OB batch — never legacy `postOpeningBalance`.
- Exact decimal arithmetic for money; no float money math.
- Business = tenant; never trust client-only business IDs.
- One Opening Journal per setup version (B1).
- Do not mark setup completed before the posting transaction commits.
- Do not force completed businesses into wizard on login.
- Hidden primary branch only (no user-facing branches).

---

## File map (Slice 1 — foundation)

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | `BusinessSetupRun`, `BusinessSetupStep` models |
| `prisma/migrations/20260722160000_business_setup_run/` | Migration |
| `lib/setupWizard/constants.js` | Statuses, step ids, setup types |
| `lib/setupWizard/stateMachine.js` | Legal transitions |
| `lib/setupWizard/errors.js` | Typed setup errors |
| `lib/setupWizard/activityClassifier.js` | D2 business activity class |
| `lib/setupWizard/setupRunService.js` | Create/get/resume/save/progress |
| `app/api/setup/runs/route.js` | POST create, GET list/active |
| `app/api/setup/runs/[id]/route.js` | GET/PATCH run |
| `app/setup/page.js` | Full-page wizard shell (replace redirect) |
| `components/setup/BusinessSetupWizard.jsx` | Stepper + progress UI |
| `components/setup/SetupWizardHost.jsx` | Launch `/setup` instead of modal-only |
| `test/setupWizard/*` | Unit tests for state machine, classifier, service |
| `docs/setup-wizard/SETUP_DOMAIN_MODEL.md` | Domain docs |
| `docs/setup-wizard/SETUP_STATE_MACHINE.md` | State docs |

---

### Task 1: Constants, errors, state machine (TDD)

**Files:**
- Create: `lib/setupWizard/constants.js`
- Create: `lib/setupWizard/errors.js`
- Create: `lib/setupWizard/stateMachine.js`
- Create: `test/setupWizard/stateMachine.test.js`

- [x] Write failing tests: legal transitions `IN_PROGRESS→READY_FOR_REVIEW`, reject `COMPLETED→IN_PROGRESS` without reopen; step status helpers
- [x] Implement constants + `assertRunTransition` / `canTransition`
- [x] Implement typed errors with `code`, `httpStatus`, safe message
- [x] Run `npx vitest run test/setupWizard/stateMachine.test.js` — pass

---

### Task 2: Activity classifier (D2)

**Files:**
- Create: `lib/setupWizard/activityClassifier.js`
- Create: `test/setupWizard/activityClassifier.test.js`

- [x] Write tests with mocked prisma counts (empty → `NEW_EMPTY_BUSINESS`; posted journal → `EXISTING_WITH_FINANCIAL_ACTIVITY`; posted OB batch → influences completed/conversion)
- [x] Implement classifier querying journals, invoices, bills, stock moves, V2 OB batches, setup runs
- [x] Export `assertSetupStartAllowed(classification, { setupType, conversionApproved })`
- [x] Run vitest for classifier — pass

---

### Task 3: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration folder under `prisma/migrations/`

- [x] Add `BusinessSetupRun` + `BusinessSetupStep` with unique `(tenantId, setupVersion)`, indexes on status, link fields for `openingBalanceBatchId` / `journalEntryId` as strings
- [x] `npx prisma migrate dev` or `deploy` locally as appropriate
- [x] `npx prisma generate`

---

### Task 4: Setup run service + APIs

**Files:**
- Create: `lib/setupWizard/setupRunService.js`
- Create: `app/api/setup/runs/route.js`
- Create: `app/api/setup/runs/[id]/route.js`
- Create: `test/setupWizard/setupRunService.test.js`
- Reuse: auth/business context helpers from sibling APIs (e.g. accounting-v2 routes)

- [x] `createSetupRun` — classifier gate; seed steps from constants; status `IN_PROGRESS`
- [x] `getActiveSetupRun` / `getSetupRun`
- [x] `saveSetupStep` — optimistic `draftVersion` conflict → `BusinessSetupVersionConflictError`
- [x] `getSetupProgress` — percent + blockers summary
- [x] Wire GET/POST `/api/setup/runs`, GET/PATCH `/api/setup/runs/[id]`
- [x] Enforce auth + business scope + `setup.view` / `setup.start` (map to `settings.view` temporarily if permission seed not ready — document mapping)
- [x] Tests for create + version conflict
- [x] Run vitest — pass

---

### Task 5: Full-page `/setup` UI (A3 shell)

**Files:**
- Replace: `app/setup/page.js`
- Create: `components/setup/BusinessSetupWizard.jsx` (+ small step panel components as needed)
- Modify: `components/setup/SetupWizardHost.jsx` — primary CTA navigates to `/setup?runId=…`
- Keep modal as optional thin checklist OR retire open-modal to “continue setup” link

- [x] Page loads active run or offers Start Setup
- [x] Stepper shows 23 steps (group visually); Steps 1–3 editable stubs saving via API; others “coming soon / blocked until prior”
- [x] Progress %, save & exit, resume
- [x] Mobile-friendly compact step nav
- [x] Manual smoke: open `/setup`, create run, save profile stub, refresh resumes

---

### Task 6: Domain docs for slice 1

**Files:**
- Create: `docs/setup-wizard/SETUP_DOMAIN_MODEL.md`
- Create: `docs/setup-wizard/SETUP_STATE_MACHINE.md`
- Create: `docs/setup-wizard/SETUP_ENTRY_AND_RESUME.md`
- Update: `docs/setup-wizard/README.md`, `SETUP_WIZARD_TASKS.md` (mark forks approved, slice 1)

- [x] Docs match code
- [x] No claim of full posting completion

---

## Later slices (core implemented 2026-07-22)

| Slice | Focus | Status |
|---|---|---|
| 2 | Profile, ownership, calendar, CoA, mappings | Core done |
| 3 | Payment / AR / AP / stock / assets / loans / tax / equity / manual drafts | Line capture done (not full domain docs) |
| 4 | TB preview, A=L+E, reconciliations, documents | Core done (docs = references) |
| 5 | C2 approvals, B1 compile + V2 batch post, lock, idempotency | Core done |
| 6 | D2 conversion UX, reopen, tests, final report | Core done (imports pack / E2E still open) |

---

## Verification (Slice 1 exit)

```bash
npx vitest run test/setupWizard
npx prisma validate
```

Manual: `/setup` start → save → reload → resume; classifier blocks conversion without flag in unit tests.
