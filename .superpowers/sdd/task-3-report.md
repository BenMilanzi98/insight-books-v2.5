# Task 3 Report: Reconcile Account CTA on hub

## Status
**DONE**

## Summary
Added a permission-gated **Reconcile Account** CTA on `/payments` for Bank and Mobile Money rows, navigating to `/payments/reconcile/[paymentAccountId]`. Hub title/subtitle now use **Accounts & Reconciliation** language. Cash (and other ineligible types) do not show the CTA.

## Changes implemented

### Step 1: Pass reconcile handler into panel (`app/payments/page.js`)
- Load `bankReconciliation.view` alongside `payments.create` in the existing `getPermission` `useEffect`.
- `canReconcile` from page permissions.
- `handleReconcileAccount` → `router.push(`/payments/reconcile/${account.id}`)`.
- Pass `onReconcileAccount={canReconcile ? handleReconcileAccount : undefined}` into `PaymentChannelsPanel`.
- Hub copy:
  - Title: **Accounts & Reconciliation**
  - Subtitle: Reconcile Bank and Mobile Money against statements; Cash stays without a Reconcile action; manage channels under Manage accounts.

### Step 2: AccountRow CTA (`components/payments/PaymentChannelsPanel.jsx`)
- Import `isGuidedReconcilableAccountType` from `@/lib/bankReconciliation/domain/guidedLabels`.
- Thread `onReconcileAccount` through `PaymentChannelsPanel` → `ChannelCard` → `AccountRow` (also cash and other rows so eligibility is the only gate).
- Non-management `AccountRow`: if eligible and handler provided, render **Reconcile Account** button with `stopPropagation` then `onReconcileAccount(account)`.
- Row click still opens history/select.
- Outer dashboard row changed from `<button>` to `<div>` so the CTA is not a nested button.

### Step 3: Verify
Bank / Mobile Money show CTA; Cash does not. See Verification below.

### Step 4: Commit
- **SHA:** `38c111b61`
- **Subject:** `feat(payments): Reconcile Account CTA for Bank and Mobile Money`
- **Files committed (2):**
  - `app/payments/page.js`
  - `components/payments/PaymentChannelsPanel.jsx`

## Verification

| Check | Result |
|-------|--------|
| CTA text is `Reconcile Account` | Pass (source) |
| Condition uses `isGuidedReconcilableAccountType(account.accountType) && onReconcileAccount` | Pass |
| `handleReconcileAccount` pushes `/payments/reconcile/${account.id}` | Pass |
| Handler omitted when `!canReconcile` | Pass |
| Permission loaded: `bankReconciliation.view` via `getPermission` | Pass |
| Title is Accounts & Reconciliation | Pass |
| CTA not rendered in management mode (early return) | Pass |
| Linter on changed files | Pass (0 errors) |
| `test/bankReconciliation.guidedEligibility.test.js` | **3/3 passed** (`npx vitest run test/bankReconciliation.guidedEligibility.test.js`) |
| Eligibility matrix (`isGuidedReconcilableAccountType` + handler) | Bank: true, Mobile Money: true, Cash: false, Wallet: false, Bank with no handler: false |
| Browser check of `/payments` rows | Not run (no UI test harness / RTL in repo) |

## TDD Evidence
Task brief did not include a new test file; the repo has no React Testing Library. Eligibility behavior was already covered by Task 1 tests (re-run green). CTA visibility is `isGuidedReconcilableAccountType` plus the permission-gated handler.

- **RED:** N/A (no new test file in brief; committing only the two specified files).
- **GREEN:** `npx vitest run test/bankReconciliation.guidedEligibility.test.js` — Test Files 1 passed, Tests 3 passed.

## Self-review
- Scope matches brief; unrelated dirty files were not staged.
- Nested `<button>` avoided by wrapping the dashboard row in a clickable `div` (required so `stopPropagation` works without invalid HTML).
- Ineligible types (Cash, Wallet, POS, etc.) share the same row component; the helper is the only gate.
- Missing `bankReconciliation.view` hides the CTA (spec: show account without Reconcile).

## Concerns / follow-ups
1. **`/payments/reconcile/[id]` does not exist yet** — CTA navigates there; 404 until Task 4 (expected).
2. **Subtitle copy** was inferred from spec (no exact string in brief); title is the specified **Accounts & Reconciliation**.
3. **Dashboard row is no longer a native `<button>`** — history click is `div` onClick; keyboard activation of the row is weaker than before (CTA remains a real button).
4. **No component-level UI test** — brief did not list a test file; verification is source + eligibility unit tests, not a rendered row snapshot.
5. **Management mode** has no CTA (brief: non-management `AccountRow` only).

---

## Review fix: keyboard access on dashboard AccountRow

**Status:** DONE  
**Commit:** (see below after commit)

### Problem
Task 3 review flagged that the dashboard `AccountRow` used a clickable `<div>` wrapper so the Reconcile CTA would not be a nested `<button>`. That removed native keyboard and screen-reader access for history/select.

### Fix
- Non-interactive wrapper `<div>` with **two sibling `<button>` elements** (no `role="button"` on parent).
- **History/select:** `flex-1` button → `onSelect?.(account)`; includes account label, balance, chevron; focus-visible ring for keyboard users.
- **Reconcile CTA:** `shrink-0` sibling when `isGuidedReconcilableAccountType(account.accountType) && onReconcileAccount`; `px-2 py-1.5` for touch target; no `stopPropagation` (siblings).
- Eligibility gate unchanged; management mode unchanged.

### Files
- `components/payments/PaymentChannelsPanel.jsx` only (no `page.js` change).

### Verification

| Check | Result |
|-------|--------|
| No nested buttons | Pass — wrapper is plain `div`, two sibling buttons |
| History row is focusable/activatable | Pass — native `<button type="button">` |
| Reconcile CTA still gated by `isGuidedReconcilableAccountType` + handler | Pass (source) |
| Linter on changed file | Pass (0 errors) |
| `npx vitest run test/bankReconciliation.guidedEligibility.test.js` | **3/3 passed** |

### Commit
- **Subject:** `fix(payments): restore keyboard access on reconcile account rows`

