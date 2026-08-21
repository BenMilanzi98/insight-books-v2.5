# Task 7 Report: Resolve — create Expense / Money in

## Status
**DONE_WITH_CONCERNS**

## Summary
Replaced the Resolve wizard placeholder with `ResolveStep`: unmatched bank lines get **Create Transaction** (Expense → `BANK_CHARGE`, Money in → `INTEREST`) posting via `POST /api/bank-reconciliation/adjust` with `postAdjustment: true` and an offset CoA picker. Workspace refreshes after success. Outstanding books are listed; leave-as-is is allowed.

## Changes implemented

### Step 1: UI for unmatched bank rows
- `ResolveStep.jsx`: unmatched / partial statement lines (`canCreateTransactionForStatement`, same gate as Match selectable).
- **Create Transaction** opens a small form: Type (Expense | Money in), offset account `<select>`, description (defaults to statement description).
- Offset CoA: `GET /api/accounts?forSelect=true&type=Expense` or `type=Income`.
- Submit: `buildAdjustBody` → `postReconAdjustment` → `onRefresh(reconciliationId)` (`getReconciliationWorkspace`).

Map:
- Expense → `classification: 'BANK_CHARGE'`
- Money in → `classification: 'INTEREST'`

### Step 2: Outstanding books
- Lists `workspace.outstanding` (date / description / itemType / amount).
- Copy: leave-as-is is OK. No unmatch control — matches API only has accept/reject, not unmatch.

### Step 3: Commit
- **SHA:** `9c5c8b668`
- **Subject:** `feat(payments): create expense or money-in from unmatched bank lines`
- **Files (4):**
  - `components/payments/reconcile/ResolveStep.jsx` (created)
  - `components/payments/reconcile/reconApi.js`
  - `components/payments/reconcile/ReconcileWizard.jsx`
  - `test/guidedReconcileWizard.test.js` (TDD; not in brief `git add` list)

## Verification

| Check | Result |
|-------|--------|
| Expense → BANK_CHARGE, Money in → INTEREST | Pass (tests) |
| Adjust POST body: reconciliationId, statementTransactionId, postAdjustment true, offsetAccountId, description | Pass (tests) |
| Offset picker `/api/accounts?forSelect=true&type=` Expense/Income | Pass (helpers + tests) |
| Create Transaction only for unmatched/partial bank lines | Pass (tests) |
| After success refresh workspace | Pass (source: `onRefresh`) |
| Outstanding listed; leave-as-is OK | Pass (source) |
| ESLint on task files | Pass (exit 0) |
| Browser smoke (create expense / money in) | Not run |

## TDD Evidence

- **RED:** `npx vitest run test/guidedReconcileWizard.test.js` — **4 failed** (helpers missing: `classificationForResolveType`, `buildAdjustBody`, `canCreateTransactionForStatement`, `listOffsetAccounts`). Existing 20 tests still passed.
- **GREEN:** same command after helpers + ResolveStep wiring — **24/24 passed**.

## Self-review
- Adjust route is `POST /api/bank-reconciliation/adjust`; body matches `classifyAndAdjust` (`offsetAccountId` used as expense or income account).
- Did not stage unrelated dirty files (stock APIs, AppShell, locales, `.superpowers` briefs).
- Complete remains a placeholder.

## Concerns / follow-ups
1. Live browser smoke (Create Transaction → adjust → classified line) was not run.
2. Test file was extra vs the brief `git add` list (same as Tasks 4–6 TDD).
3. Optional unmatch skipped: `POST /api/bank-reconciliation/matches/[id]/[action]` only supports accept/reject.
4. Offset picker uses `/api/accounts` type filter, not the posting-eligible chart picker; header/non-postable rows may appear. Income vs Revenue: blueprint stores `Income`.
5. Full Vitest suite was not run (focused wizard tests only).

## Review fix: Create Transaction gate (PARTIAL over-post)

### Problem
Create Transaction was offered for `PARTIAL` lines via `isStatementSelectable`, but the adjust API posts the full statement amount and could over-post GL.

### Fix
- `canCreateTransactionForStatement` now requires `matchingStatus === 'UNMATCHED'` exactly (not PARTIAL / SUGGESTED / MATCHED / etc.).
- Manual match selection (`isStatementSelectable`) unchanged — PARTIAL lines remain eligible for manual match.
- Test updated: PARTIAL and SUGGESTED are not eligible for Create Transaction.

### Commit
- **Subject:** `fix(payments): only create transaction for fully unmatched bank lines`
- **Verification:** `npx vitest run test/guidedReconcileWizard.test.js`
