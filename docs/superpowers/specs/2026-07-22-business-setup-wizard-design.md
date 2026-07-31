# Business Setup Wizard — Design Spec

**Date:** 2026-07-22  
**Status:** CLOSED — core implementation handed off (2026-07-22). See `docs/setup-wizard/FINAL_SETUP_WIZARD_REPORT.md`.  
**Approved decisions:** A3 · B1 · C2 · D2

---

## 1. Goal

Deliver a controlled, resumable Business Setup Wizard that configures a Business for go-live and posts **one consolidated Opening Journal** through the Accounting V2 Posting Engine, with Trial Balance balance, Assets = Liabilities + Equity, and subledger control reconciliations before completion.

---

## 2. Approved architecture decisions

### A3 — Hybrid shell

| Surface | Role |
|---|---|
| Full-page `/setup` | Primary resumable wizard (replaces redirect-to-modal) |
| Dashboard checklist / `SetupWizardHost` | Launcher + progress summary; opens `/setup` (or resumes active run) |
| Login / soft onboarding | Remains non-blocking for completed or in-progress businesses (`requiresCapital` / `requiresPayments` stay off unless product later re-enables) |

Completed businesses are **not** forced into the wizard on ordinary login. Re-entry only via settings, checklist (if incomplete), or controlled reopen / conversion.

### B1 — One consolidated Opening Journal

Final posting produces **exactly one** balanced Opening Journal per Setup Run version.

| Piece | Role |
|---|---|
| `BusinessSetupRun` | Orchestrates drafts, validation, approval, completion |
| Domain draft records | Capture AR/AP/stock/assets/loans/equity/payment/manual lines |
| Line compiler | Builds one balanced line set (base currency) |
| `AcctV2OpeningBalanceBatch` | Existing V2 batch — already posts **one** journal via `OPENING_BALANCE_POSTED` |
| Posting Engine `executePosting` | Sole GL authority |

**Not in scope for B1:** multiple domain journals in one batch. Domain journals may be previewed as **sources** in the UI, but the posted financial effect is a single consolidated journal linked to the Setup Run and OB batch.

Idempotency key (conceptual): `BUSINESS_SETUP:<businessId>:<setupVersion>` → unique OB batch / journal source identity.

### C2 — Policy-driven segregation of duties

| Tenant shape | Behaviour |
|---|---|
| Sole proprietor / single finance admin | Preparer may approve and post (policy flag / role count) |
| ≥2 distinct finance roles configured | Self-approval denied; approve ≠ prepare; post may require `setup.post` separately where policy says so |
| Auditor | Read-only setup, documents, reconciliations, journals, audit |

Material edits after approval invalidate approval (checksum). Existing V2 OB service’s separate-approver rule is **relaxed only when C2 policy allows combined roles**; otherwise keep separate approver.

### D2 — Existing business conversion

Before starting or restarting financial setup, classify business activity:

- `NEW_EMPTY_BUSINESS`
- `NEW_PARTIALLY_CONFIGURED_BUSINESS`
- `EXISTING_WITHOUT_FINANCIAL_ACTIVITY`
- `EXISTING_WITH_FINANCIAL_ACTIVITY`
- `EXISTING_SETUP_COMPLETED`
- `REQUIRES_CONTROLLED_CONVERSION`
- `BLOCKED`

For `EXISTING_WITH_FINANCIAL_ACTIVITY` / completed setups:

1. Require setup type `EXISTING_BUSINESS_CONVERSION` (or reopen path).
2. Require Finance approval + reason.
3. Require backup / snapshot acknowledgement.
4. Dry-run validation (TB/reconcile preview) before post.
5. Never silently create a second opening effect for the same version identity.

---

## 3. Setup Run aggregate

### 3.1 Core model (new)

`BusinessSetupRun` (name may be `SetupRun` in code under `lib/setupWizard/`):

| Field | Notes |
|---|---|
| `id`, `tenantId` (Business) | Tenant = Business |
| `setupVersion` | Int, starts at 1; reopen increments |
| `setupType` | `NEW_BUSINESS` \| `EXISTING_BUSINESS_CONVERSION` \| `DATA_MIGRATION` \| `OPENING_BALANCE_ONLY` \| `REIMPLEMENTATION_RECOVERY` |
| `status` | See state machine |
| `currentStepId` | Wizard step key |
| `openingBalanceDate`, `cutoverDate` | Required before financial steps |
| `financialYearLabel` / `accountingPeriodId` | Resolved server-side |
| `baseCurrency`, `timezone` | From profile |
| `completionPercent` | Derived + stored |
| `draftVersion` / `rowVersion` | Optimistic concurrency |
| Actor stamps | created/updated/submitted/reviewed/approved/posted |
| `openingBalanceBatchId` | FK/link to `AcctV2OpeningBalanceBatch` |
| `journalEntryId` | After post |
| `sourceChecksum` | Invalidates approval on material change |
| `reopenReason`, etc. | Controlled reopen |

`BusinessSetupStep` — per-step status, payload snapshot or pointer, warnings.

Keep soft `TenantSettings.setupWizardState` as a **derived mirror** for dashboard checklist during migration; Setup Run is authoritative once created.

### 3.2 Run statuses

`NOT_STARTED` → `IN_PROGRESS` → `WAITING_FOR_INFORMATION` → `READY_FOR_REVIEW` → `UNDER_REVIEW` → `CHANGES_REQUIRED` → `APPROVED` → `POSTING` → `COMPLETED` | `COMPLETED_WITH_WARNINGS` | `POSTING_FAILED`

Also: `REOPEN_REQUESTED` → `REOPENED` → new version; `REVERSED`; `CANCELLED`.

### 3.3 Step statuses

`NOT_STARTED` | `IN_PROGRESS` | `COMPLETED` | `COMPLETED_WITH_WARNINGS` | `BLOCKED` | `SKIPPED_OPTIONAL` | `REQUIRES_REVIEW` | `APPROVED` | `POSTED`

---

## 4. Wizard steps (capability map)

UI may group steps; all capabilities exist:

1. Welcome & Business Profile  
2. Legal Structure & Ownership  
3. Financial Calendar & Opening/Cutover dates  
4. Chart of Accounts  
5. System Account Mappings  
6. Payment Accounts  
7. Customers  
8. Opening Receivables  
9. Suppliers  
10. Opening Payables  
11. Inventory Items  
12. Opening Stock  
13. Fixed Assets  
14. Other Assets  
15. Liabilities & Loans  
16. Taxes & Statutory  
17. Capital & Equity  
18. Other / Manual Opening Balances  
19. Opening Trial Balance Review  
20. Subledger Reconciliation  
21. Supporting Documents  
22. Final Review & Approval  
23. Posting & Completion  

Optional skips allowed only for non-applicable domains (e.g. no inventory business skips items/stock with explicit skip + reason).

Legal structure drives equity UI (sole vs partnership vs company) without auto-creating capital balances.

---

## 5. Opening journal compilation (B1)

1. Collect all draft opening sources for the Setup Run.  
2. Compile to GL lines (exact decimals, base currency).  
3. Resolve Opening Balance Equity / conversion clearing to equity per policy until unexplained difference = 0 (unless approved temporary exception).  
4. Preview TB + A=L+E + control reconciliations.  
5. On approve + post: create/update one `AcctV2OpeningBalanceBatch` with compiled lines → existing approve/post → **one** journal.  
6. Link subledger opening records to that journal / batch id.  
7. Mark Setup Run `COMPLETED` only after commit succeeds.

**Accounting bans (enforced in compiler + tests):** opening AR ≠ Revenue; opening AP ≠ current Expense; opening stock ≠ Expense/COGS; loans/capital ≠ Revenue; no duplicate Capital / RE / CYE; no direct balance mutation.

---

## 6. Permissions (initial set)

Reuse / extend existing permission framework:

- `setup.view`, `setup.start`, `setup.*.manage` (by domain), `setup.review`, `setup.submit`, `setup.approve`, `setup.post`, `setup.reopen.request`, `setup.reopen.approve`, `setup.reverse`, `setup.import`, `setup.export`

UI hides actions; API enforces always.

Map onto existing `openingBalances.*` for the V2 batch post path where appropriate.

---

## 7. Reuse vs new

| Reuse | New |
|---|---|
| `AcctV2OpeningBalanceBatch` + `openingBalanceService` (V2) | `BusinessSetupRun` / steps / issues / docs / reopen |
| Posting Engine, period resolve, CoA V2 mappings | Setup line compiler + reconciliation service |
| Stock basic import, asset/liability/equity/client modules | Wizard orchestration APIs + full-page UI |
| Dashboard checklist components | Redirect `/setup` to real wizard page |

Kill remaining legacy `postOpeningBalance` call sites as part of posting phase.

---

## 8. Out of scope for first vertical slice

First implementable slice after this spec:

1. Prisma Setup Run + step models + migration  
2. State machine + typed errors  
3. APIs: create/get/resume/save progress  
4. Full-page `/setup` shell with stepper (profile + calendar stubs wired; other steps placeholders with blockers)  
5. Activity classifier (D2) gate on start  
6. Dashboard launcher → `/setup`  

Later slices: domain capture → compile → reconcile → C2 approve → B1 post → reopen.

---

## 9. Non-negotiables

- No direct GL/TB mutation.  
- One opening journal per setup version (B1).  
- Idempotent final post.  
- No setup completion while TB unbalanced or critical controls fail.  
- No casual restart of active businesses (D2).  
- Posted journals immutable; corrections via reverse/adjust/reopen version.  
- Business-scoped; never trust client-only business IDs.

---

## 10. Success criteria (first slice)

- User can start/resume a Setup Run at `/setup`.  
- Concurrent edit conflict detected via `draftVersion`.  
- Activity classifier blocks unsafe start without conversion mode.  
- Dashboard checklist opens full-page wizard.  
- No false claim of “setup posted” until later posting slice.

---

## Spec self-review

- [x] Forks A3/B1/C2/D2 explicit  
- [x] B1 aligned with existing one-journal OB batch  
- [x] No placeholder “TBD” for core architecture  
- [x] First slice bounded; full 23-step not claimed in slice 1  
- [x] No contradiction with Accounting V2-only posting policy  
