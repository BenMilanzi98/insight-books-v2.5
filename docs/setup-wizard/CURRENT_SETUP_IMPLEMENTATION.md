# Current Setup / Onboarding Implementation

**Date:** 2026-07-22  
**Scope:** Forensic inventory of InsightBooks V2 business setup, opening balances, and related domains.  
**Status:** Analysis only — no reimplementation claimed.

---

## 1. Executive summary

InsightBooks already has a **lightweight optional Setup Wizard** (≈10 steps) and a **production Accounting V2 Opening Balance Batch** API. They are **not connected**.

| Layer | What exists | Usable for master prompt? |
|---|---|---|
| Wizard UI | Dashboard modal + checklist + tips | Partial shell only |
| Wizard state | `Business.settings.setupWizard` JSON | Soft progress only |
| Soft onboarding gates | Capital / payment checks **forced off** | Does not block ops |
| Legacy OB API | `POST /api/accounts/opening-balances` → **410** | Dead |
| Legacy OB service | `postOpeningBalance` **throws** | Dead |
| V2 OB batches | Create → approve → post via Posting Engine | **Live API, no wizard UI** |
| Full 23-step onboarding | Not present | Missing |
| `BusinessSetupRun` aggregate | Not present | Missing |
| Controlled reopen / SoD / completion pack | Not present as specified | Missing |

**Honest readiness for the master prompt:** NOT STARTED as a controlled accounting onboarding framework. Existing pieces are reusable building blocks.

---

## 2. Entry points and routes

| Route / surface | Behaviour |
|---|---|
| `/setup` | `app/setup/page.js` — client redirect to `/dashboard?setupWizard=1` |
| Dashboard | `SetupWizardHost` opens modal when `?setupWizard=1` or incomplete wizard |
| Financial setup | `/financial-setup`, `/financial-setup/opening-balances` |
| Capital | `/capital-account` |
| Assets | `/asset-management` |
| Liabilities | `/liability-management` |
| Payments | `/payments/management` |
| Taxes | `/tax-management` |
| Clients | `/clients` |
| Stock | `/stock`, `/stock/import` (basic Excel import Slice 1) |
| Equity V2 | `/equity-management` |
| Calendar V2 | `/financial-calendar-v2` |
| CoA governance | `/chart-of-accounts/governance` |
| Accounting V2 OB | API only under `/api/accounting-v2/opening-balances` |

No dedicated `/onboarding/business-setup` or resumable full-page wizard route.

---

## 3. Setup Wizard (current product)

### 3.1 Step catalogue (`lib/setupWizardStepsMeta.js`)

Optional steps (order):

1. `startingDate` — Starting date → `/financial-setup/opening-balances`
2. `capital` — Capital & equity → `/capital-account`
3. `assets` — Fixed assets → `/asset-management`
4. `liabilities` — Liabilities & loans → `/liability-management`
5. `paymentAccounts` — Payment accounts → `/payments/management`
6. `taxes` — Taxes (MRA) → tax management
7. `clients` — Clients → `/clients`
8. `products` — Products / stock → `/stock`
9. `openingBalances` — Opening balances → financial-setup
10. `review` — Review & finish

**Missing vs master prompt (explicit):** Legal structure / ownership, Financial Year + periods as first-class wizard steps, CoA + system mappings, Opening Receivables / Payables as subledgers, Opening Stock valuation + GL, Other assets, Tax statutory schedules, Manual TB lines, TB preview, Subledger reconciliation centre, Documents, Approval/SoD, Posting via engine, Completion lock, Controlled reopen.

### 3.2 State model

- Stored in `Business.settings` JSON under `setupWizard` (and related keys).
- Service: `lib/setupWizardService.js` — progress %, completed/skipped steps, derived completion heuristics.
- Tests: `test/setupWizardService.test.js`.
- **No** `BusinessSetupRun`, step versions, checksums, approval records, or posting batch FK.

### 3.3 Soft onboarding (`lib/softOnboarding.js`)

Historically gated capital / payments; **currently forces** `requiresCapital: false`, `requiresPayments: false` so normal login is not blocked. Aligns with “do not force completed business back into wizard” for ops — but also means incomplete setup is not enforced.

### 3.4 UI components

- `components/setup/SetupWizardHost.jsx`
- `components/setup/SetupWizard*.jsx` (modal, stepper, checklist)
- Progress is UX-oriented; financial truth is not tied to wizard completion.

---

## 4. Business profile and creation

- Business create / select flows exist in auth and business APIs (multi-tenant `Business` / tenant scoping).
- Profile fields (legal name, TIN, address, currency, timezone, legal structure) are scattered across business settings / profile UIs — **not** a single wizard Step 1–2 with ownership ratios driving equity options.
- Hidden primary branch pattern: location via `resolveHiddenPrimaryBranchId` / `ensurePrimaryBranchForTenant` (no user-facing branches).

---

## 5. Financial calendar and periods

| Capability | Location | Wizard integration |
|---|---|---|
| Accounting V2 periods / FY | `/api/accounting-v2/periods/*`, `/financial-calendar-v2` | Linked indirectly via starting date only |
| Period open/close | Period service + close module | Not enforced in wizard completion |
| Opening balance date / cutover | Partially via financial-setup / OB date | No canonical cutover + OB date pair in setup aggregate |

---

## 6. Chart of Accounts and system mappings

| Capability | Location | Wizard integration |
|---|---|---|
| CoA V2 / governance | `/api/coa-v2/*`, governance page | Outside wizard |
| System account registry / mappings | CoA mapping APIs + posting rules | Not a wizard step |
| Default template apply | CoA templates API | Not wizard-driven |

---

## 7. Opening balances — two stacks

### 7.1 Legacy (removed for posting)

| Piece | Status |
|---|---|
| `lib/openingBalanceService.js` → `postOpeningBalance` | Throws / fails closed — directs to V2 |
| `POST /api/accounts/opening-balances` | **410 Gone** |
| Call sites still using legacy | Wizard-related financial-setup / stock paths that still invoke `postOpeningBalance` → **silent or hard GL failure** |

### 7.2 Accounting V2 (canonical)

| Piece | Status |
|---|---|
| Models | `AcctV2OpeningBalanceBatch` (+ lines / approve / post) |
| API | `/api/accounting-v2/opening-balances` and `[id]/[action]` |
| Posting | Central Posting Engine (`executePosting`) |
| Idempotency | Batch / event identities |
| Wizard UI | **None** — API/manual/ops only |
| Docs | `docs/accounting-posting-engine/OPENING_BALANCE_FRAMEWORK.md` |

### 7.3 Domain-specific opening paths (partial)

| Domain | Behaviour today | GL via Posting Engine? |
|---|---|---|
| Payment accounts | Opening amounts on payment accounts / financial-setup | Often legacy or direct; not wizard-orchestrated V2 batch |
| Capital | Capital account contributions | Mixed; equity-management V2 exists separately |
| Customers / AR | Client create; receivables via invoices | No opening-invoice wizard step posting to V2 OB |
| Suppliers / AP | Supplier + bills | No opening-bill wizard step |
| Opening stock | Qty/FIFO/WAC import Slice 1; some paths still call legacy OB | **GL clearing largely unwired / broken** |
| Fixed assets | Asset register + depreciation APIs | Opening cost / accum dep not wizard-batched |
| Loans / liabilities | Liability module | Not setup-run linked |
| Taxes | Tax management | Not statutory OB wizard |
| Manual TB | Financial-setup screens | Not V2-batch controlled from wizard |

---

## 8. Inventory / opening stock

- Operational stock: `/stock`, FIFO `InventoryBatch`, WAC helpers, basic Excel import (`/api/stock/basic-import/*`).
- Opening stock as **accounting cutover** (Dr Inventory / Cr Opening Balance Equity via engine, one event identity, reconcile to control) is **not** complete.
- Risk: quantity/value updated without canonical opening journal, or duplicate attempts if legacy + V2 both used later.

---

## 9. Posting engine, GL, TB, reports

| Component | Status |
|---|---|
| Central Posting Engine | Live for Accounting V2 |
| Journals / ledger V2 | Live APIs + UI pages |
| Trial Balance / Balance Sheet | Report routes (legacy + V2 reports) |
| Setup must post only via engine | **Required by policy; wizard does not enforce** |

Legacy `postGlEntry` fails closed (`LEGACY_POSTING_REMOVED`).

---

## 10. Permissions, approvals, audit

| Area | Exists? | Setup-specific? |
|---|---|---|
| Role / permission framework | Yes (app-wide) | No granular `setup.*` matrix as specified |
| Approval policy engine | Security-governance / approvals APIs | Not wired to setup submit/approve/post |
| Audit | Various audit logs + security governance | No complete setup-run audit catalogue |
| Notifications | Partial product notifications | No setup lifecycle notifications as specified |

---

## 11. Imports / exports

| Domain | Import/export |
|---|---|
| Stock basic Excel | Template / preview / confirm + export (Slice 1) |
| Customers / suppliers / AR / AP / assets / loans / TB | Scattered or missing preview-confirm idempotent setup imports |
| Setup Completion Pack | Not present |

---

## 12. Tests and feature flags

| Item | Notes |
|---|---|
| `test/setupWizardService.test.js` | Wizard JSON / derived steps |
| `test/accountingV2.postingEngine.test.js` | Includes V2 opening balance posting |
| Setup E2E (23-step) | Not present |
| Feature flag for full wizard | Not found as dedicated flag |

---

## 13. What is valid and reusable

1. Optional wizard shell (steps meta, host, progress JSON).
2. Accounting V2 Opening Balance Batch + Posting Engine.
3. Financial calendar V2, CoA V2, equity-management, bank reconciliation, loan/liability/asset modules.
4. Stock basic import (name match, WAC, FIFO batch) as input to Opening Stock step.
5. Soft onboarding already avoids forcing completed businesses into wizard on login.
6. Multi-tenant Business scoping patterns and hidden primary branch.

---

## 14. What is incomplete or dangerous

1. Wizard completion ≠ posted balanced opening position.
2. Dead legacy OB still referenced from setup-adjacent code paths.
3. No single Setup Run aggregate / state machine / idempotent final post.
4. No subledger reconciliation gate before “done”.
5. No SoD / approval / reopen with journal immutability.
6. Opening stock / AR / AP / assets / loans not orchestrated into one balancing batch.
7. Derived “step complete” heuristics can mark progress without GL truth.
8. Existing businesses with operational activity have no controlled conversion classifier.

---

## 15. Search-term coverage (repo)

Keywords scanned conceptually: onboarding, setup, wizard, opening balance, opening stock, cutover, receivable/payable opening, payment/bank/cash/mobile money, fixed asset, accumulated depreciation, liability, loan, capital, equity, retained earnings, trial balance, account mapping, setup completed, business readiness.

**Result:** Many domain modules exist; **canonical Business Setup Wizard + Opening Journal Batch orchestration does not.**
