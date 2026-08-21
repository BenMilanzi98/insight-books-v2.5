# Task 6 Report: Match step (auto + manual 1:N)

## Status
**DONE_WITH_CONCERNS**

## Summary
Replaced the Match wizard placeholder with `MatchStep`: two-column statement / outstanding layout, **Auto Match**, client-side 1:N amount check before **Match**, and accept/reject for `SUGGESTED` matches. Workspace refreshes after auto, manual, and suggestion actions.

## Changes implemented

### Step 1: Layout
- `MatchStep.jsx`: stacked on mobile, two columns on `lg`.
  - Left: statement lines with `guidedStatementStatusLabel` badges (Matched / Unmatched bank).
  - Right: book candidates labeled **Outstanding** (`guidedOutstandingLabel()`), merged from `GET /candidates` (preferred, signed `remainingAmountMinor`) and workspace `outstanding` (`amountMinor`).
- Actions: **Auto Match**; select one bank radio + one/more book checkboxes → **Match**.
- Before POST, `canPostManualMatch`: `abs(signedAmountMinor) === sum(abs(book amounts))`. Mismatch shows both totals (`manualMatchAmountError`) and does not call the API. Live totals also shown while selecting.

### Step 2: Auto Match
- `POST /api/bank-reconciliation/reconciliations/${id}/auto-match` with `body: '{}'`.
- Refresh workspace + candidates; toast with `matchesCreated` when the field is returned.
- Suggested matches (`status === SUGGESTED`) get **Accept** / **Reject** via `/api/bank-reconciliation/matches/[id]/[action]`.

### Step 3: Commit
- **SHA:** `0c563da06`
- **Subject:** `feat(payments): auto and manual match in guided reconcile`
- **Files (4):**
  - `components/payments/reconcile/MatchStep.jsx` (created)
  - `components/payments/reconcile/reconApi.js`
  - `components/payments/reconcile/ReconcileWizard.jsx`
  - `test/guidedReconcileWizard.test.js` (TDD; not in brief `git add` list)

## Verification

| Check | Result |
|-------|--------|
| Two-column layout + status badges + Outstanding label | Pass (source) |
| Auto Match POST `{}` then refresh + toast `matchesCreated` | Pass (helpers + source) |
| Manual 1:N POST body `statementIds` + `bookLinks` | Pass (tests) |
| Client amount check blocks mismatch with both totals | Pass (tests + UI) |
| Candidates GET uses `paymentAccountId` (API required) | Pass |
| Accept/reject suggestion routes | Pass (tests) |
| ESLint on task files | Pass (exit 0, no warnings after hook fix) |
| Browser smoke (auto/manual match) | Not run |

## TDD Evidence

- **RED:** `npx vitest run test/guidedReconcileWizard.test.js` — **6 failed** (helpers missing: `statementBankAbsMinor`, `manualMatchAmountError`, `buildManualMatchBody`, `autoMatchReconciliation`, `listMatchCandidates`, `postManualMatch` not functions). Existing 10 import/statement tests still passed.
- **GREEN:** same command after helpers — **16/16 passed**. After MatchStep + wizard wiring: **16/16 passed**. Also `test/bankReconciliation.guidedEligibility.test.js` with wizard tests: **19/19 passed**.

## Self-review
- Workspace GET fields used: `statements[].signedAmountMinor` / `matchingStatus`; `outstanding[].journalEntryLineId` / `amountMinor` / `itemDate`; `matches[].status`.
- Candidates API does **not** accept `reconciliationId` as the required key — it requires `paymentAccountId`. Client sends `paymentAccountId` plus optional `reconciliationId` and period dates.
- Manual match body includes plan `amountMinor` **and** `allocatedAmountMinor` (same signed value) because `createMatchRecord` only honors `allocatedAmountMinor` for 1:N allocations.
- Did not stage unrelated dirty files (stock APIs, AppShell, locales, `.superpowers` briefs).
- Resolve/Complete remain placeholders.

## Concerns / follow-ups
1. Live browser smoke (Auto Match / 1:N Match / mismatch banner) was not run.
2. Test file was extra vs the brief `git add` list (same as Tasks 4–5 TDD).
3. Candidates query still sends `reconciliationId` even though the route ignores it (harmless; `paymentAccountId` is what the API uses).
4. ~~Outstanding-only rows store `amountMinor` as absolute; unsigned POST magnitudes.~~ Addressed in review follow-up (sign from `itemType` / bank).
5. Optional notes field is extra vs the layout bullets (body schema allows `notes?`).
6. Full Vitest suite was not run (focused wizard + eligibility tests only).

## Review follow-up (Critical + Important)

Fixed stale selection after Auto Match / suggestion actions, refused manual match on non-selectable bank lines (including `SUGGESTED`), and signed outstanding fallback book amounts before POST.

### Critical
- Clear `selectedStatementId` / `selectedBookIds` after Auto Match and after manual/suggestion success (`clearMatchSelection`).
- `handleManualMatch` refuses unless `isStatementSelectable(selectedStatement)`.
- Match button disabled when `!canAttemptManualMatch` (not selectable **or** amounts do not match).
- `SUGGESTED` is not selectable for the manual radio — Accept/Reject instead.

### Important
- `bookCandidateAmountMinor(book, statement)`: prefer signed `remainingAmountMinor`; else sign `amountMinor` from `itemType` (`OUTSTANDING_PAYMENT` → negative); else bank `signedAmountMinor` sign.
- `buildManualMatchBody` passes the statement so `bookLinks` are signed.
- Merge keeps outstanding `itemType` when overlaying candidates (`{ ...existing, ...candidate }`).

### Tests
- `npx vitest run test/guidedReconcileWizard.test.js` — **20/20 passed**.
- New coverage: SUGGESTED not selectable, `canAttemptManualMatch` refuse helper, signed outstanding `bookLinks`.

### Commit
- **SHA:** `16317ce6f`
- **Subject:** `fix(payments): clear match selection and sign book amounts`
