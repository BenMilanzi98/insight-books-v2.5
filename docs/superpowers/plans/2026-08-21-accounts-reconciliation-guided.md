# Accounts & Reconciliation (Guided Bank Rec) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Phase 10 bank reconciliation into Payment Accounts as **Accounts & Reconciliation**, with a guided CSV/Excel match-and-complete wizard per Bank/Mobile Money account.

**Architecture:** Keep Phase 10 APIs and Prisma `BankRec*` models. Rename `/payments` hub, add `/payments/reconcile/[paymentAccountId]` guided UI that calls `/api/bank-reconciliation/*`, redirect `/bank-reconciliation`, and tighten eligibility + SoD defaults to match the product guide.

**Tech Stack:** Next.js App Router, React client pages, existing `lib/bankReconciliation/*`, Vitest, i18n JSON.

**Spec:** `docs/superpowers/specs/2026-08-21-accounts-reconciliation-guided-design.md`

## Global Constraints

- Reuse Phase 10 backend — no second ledger.
- Guided UI: CSV/Excel only (no OFX in wizard).
- Reconcile CTA: `accountType` **Bank** or **Mobile Money** only.
- Create missing: Expense (bank charge) + Money in (interest/other income) via adjust API.
- Complete only when server **Difference === 0**.
- Default `requireSeparateApprover = false` for guided path / new configs.
- Nav: single **Accounts & Reconciliation** entry; `/bank-reconciliation` redirects.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/bankReconciliation/domain/enums.js` | `RECONCILABLE_PAYMENT_TYPES` = Bank + Mobile Money only |
| `lib/bankReconciliation/domain/guidedLabels.js` | UI status labels + eligibility helpers |
| `lib/bankReconciliation/application/configService.js` | Default `requireSeparateApprover: false`; assert message |
| `components/Sidebar/Sidebar.js` | Rename hub; remove Bank Reconciliation nav item |
| `locales/en/navigation.json` (+ other locales if present) | Label strings |
| `lib/i18n/navLabelMap.js` | Map new label key |
| `app/bank-reconciliation/page.js` | Replace with redirect client/server |
| `components/payments/PaymentChannelsPanel.jsx` | Reconcile Account CTA |
| `app/payments/page.js` | Hub copy; wire reconcile navigation / history |
| `app/payments/reconcile/[paymentAccountId]/page.js` | Guided wizard page |
| `components/payments/reconcile/*` | Wizard step components (keep page thin) |
| `test/bankReconciliation.guidedEligibility.test.js` | Eligibility + SoD default tests |
| `test/bankReconciliation.completion.test.js` | Align with tightened types if needed |

---

### Task 1: Eligibility + SoD defaults (backend alignment)

**Files:**
- Modify: `lib/bankReconciliation/domain/enums.js`
- Modify: `lib/bankReconciliation/application/configService.js`
- Create: `lib/bankReconciliation/domain/guidedLabels.js`
- Create: `test/bankReconciliation.guidedEligibility.test.js`
- Modify: `test/bankReconciliation.completion.test.js` (only if assertions drift)

**Interfaces:**
- Produces: `RECONCILABLE_PAYMENT_TYPES = ['Bank', 'Mobile Money']`
- Produces: `isGuidedReconcilableAccountType(type: string): boolean`
- Produces: `guidedStatementStatusLabel(matchingStatus: string): string`
- Produces: config default `requireSeparateApprover: false`

- [ ] **Step 1: Write failing tests**

Create `test/bankReconciliation.guidedEligibility.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { RECONCILABLE_PAYMENT_TYPES } from '../lib/bankReconciliation/domain/enums.js';
import {
  isGuidedReconcilableAccountType,
  guidedStatementStatusLabel,
} from '../lib/bankReconciliation/domain/guidedLabels.js';
import { assertReconcilablePaymentAccount } from '../lib/bankReconciliation/application/configService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';

describe('guided recon eligibility', () => {
  it('allows only Bank and Mobile Money', () => {
    expect([...RECONCILABLE_PAYMENT_TYPES]).toEqual(['Bank', 'Mobile Money']);
    expect(isGuidedReconcilableAccountType('Bank')).toBe(true);
    expect(isGuidedReconcilableAccountType('Mobile Money')).toBe(true);
    expect(isGuidedReconcilableAccountType('Cash')).toBe(false);
  });

  it('rejects Cash on assert', () => {
    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Cash',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', postingAllowed: true, acceptsNewTransactions: true },
      })
    ).toThrow(AccountingValidationError);
  });

  it('maps statement statuses to guide labels', () => {
    expect(guidedStatementStatusLabel('MATCHED')).toBe('Matched');
    expect(guidedStatementStatusLabel('UNMATCHED')).toBe('Unmatched bank');
    expect(guidedStatementStatusLabel('PARTIAL')).toBe('Unmatched bank');
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npx vitest run test/bankReconciliation.guidedEligibility.test.js`

Expected: FAIL (missing `guidedLabels.js` and/or Cash still in enums)

- [ ] **Step 3: Implement**

In `enums.js`:

```js
export const RECONCILABLE_PAYMENT_TYPES = Object.freeze(['Bank', 'Mobile Money']);
```

Create `lib/bankReconciliation/domain/guidedLabels.js`:

```js
import { RECONCILABLE_PAYMENT_TYPES, StatementMatchingStatus } from './enums.js';

export function isGuidedReconcilableAccountType(accountType) {
  return RECONCILABLE_PAYMENT_TYPES.includes(accountType);
}

/** Guide §5 statuses for statement rows */
export function guidedStatementStatusLabel(matchingStatus) {
  if (matchingStatus === StatementMatchingStatus.MATCHED) return 'Matched';
  if (matchingStatus === StatementMatchingStatus.CLASSIFIED) return 'Matched';
  return 'Unmatched bank';
}

export function guidedOutstandingLabel() {
  return 'Outstanding';
}
```

In `configService.js` `upsertConfiguration`:

```js
requireSeparateApprover: input.requireSeparateApprover ?? false,
```

Keep assert message accurate: `Only Bank and Mobile Money accounts are reconcilable`.

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run test/bankReconciliation.guidedEligibility.test.js test/bankReconciliation.completion.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/bankReconciliation/domain/enums.js lib/bankReconciliation/domain/guidedLabels.js lib/bankReconciliation/application/configService.js test/bankReconciliation.guidedEligibility.test.js
git commit -m "fix(bank-rec): tighten Bank/Mobile Money eligibility and SoD default"
```

---

### Task 2: Navigation rename + redirect

**Files:**
- Modify: `locales/en/navigation.json` (and any other locale files that define `paymentAccounts`)
- Modify: `lib/i18n/navLabelMap.js`
- Modify: `components/Sidebar/Sidebar.js`
- Replace: `app/bank-reconciliation/page.js` with redirect
- Create: `app/bank-reconciliation/page.js` (server redirect) — keep path for bookmarks

**Interfaces:**
- Produces: sidebar label **Accounts & Reconciliation** → `/payments`
- Produces: `/bank-reconciliation` → `/payments` (or `/payments/reconcile/[id]` when `?paymentAccountId=` present)

- [ ] **Step 1: Update i18n**

`locales/en/navigation.json`:

```json
"paymentAccounts": "Accounts & Reconciliation",
"bankReconciliation": "Accounts & Reconciliation"
```

(Leave `bankReconciliation` key for any residual references; value may match hub.)

Update `navLabelMap.js` if hardcoded English strings are mapped:

```js
'Payment Accounts': 'navigation.paymentAccounts',
'Accounts & Reconciliation': 'navigation.paymentAccounts',
'Bank Reconciliation': 'navigation.paymentAccounts',
```

- [ ] **Step 2: Sidebar**

In `components/Sidebar/Sidebar.js`:

1. Change text for `/payments` entries from `"Payment Accounts"` to `"Accounts & Reconciliation"`.
2. **Remove** the Accounting submenu item with `href: "/bank-reconciliation"`.

- [ ] **Step 3: Redirect page**

Replace `app/bank-reconciliation/page.js` with a thin server redirect:

```js
import { redirect } from 'next/navigation';

export default async function BankReconciliationRedirect({ searchParams }) {
  const sp = await searchParams;
  const paymentAccountId = sp?.paymentAccountId;
  if (paymentAccountId) {
    redirect(`/payments/reconcile/${encodeURIComponent(paymentAccountId)}`);
  }
  redirect('/payments');
}
```

- [ ] **Step 4: Manual check**

Open `/payments` — sidebar shows **Accounts & Reconciliation**.  
Open `/bank-reconciliation` — lands on `/payments`.

- [ ] **Step 5: Commit**

```bash
git add locales/en/navigation.json lib/i18n/navLabelMap.js components/Sidebar/Sidebar.js app/bank-reconciliation/page.js
git commit -m "feat(nav): Accounts & Reconciliation hub; redirect legacy bank-rec route"
```

---

### Task 3: Reconcile Account CTA on hub

**Files:**
- Modify: `components/payments/PaymentChannelsPanel.jsx`
- Modify: `app/payments/page.js`
- Modify: hub copy strings on payments page header

**Interfaces:**
- Consumes: `isGuidedReconcilableAccountType`
- Produces: button navigates to `/payments/reconcile/[paymentAccountId]`

- [ ] **Step 1: Pass reconcile handler into panel**

In `app/payments/page.js`, import router (already present) and:

```js
const canReconcile = /* getPermission bankReconciliation.view — load in useEffect */;

const handleReconcileAccount = (account) => {
  router.push(`/payments/reconcile/${account.id}`);
};
```

Pass `onReconcileAccount={canReconcile ? handleReconcileAccount : undefined}` into `PaymentChannelsPanel`.

Update page title/subtitle from “Payment Accounts” / cash-bank-mobile copy to **Accounts & Reconciliation** language per spec.

- [ ] **Step 2: AccountRow CTA**

In `PaymentChannelsPanel.jsx` `AccountRow` (non-management mode):

- Import `isGuidedReconcilableAccountType`.
- If eligible and `onReconcileAccount` provided, render a **Reconcile Account** button that `stopPropagation` and calls `onReconcileAccount(account)`.
- Keep existing row click for history/select.

Pseudo:

```jsx
{isGuidedReconcilableAccountType(account.accountType) && onReconcileAccount ? (
  <button
    type="button"
    className="text-xs font-semibold text-indigo-700 ..."
    onClick={(e) => {
      e.stopPropagation();
      onReconcileAccount(account);
    }}
  >
    {tt('Reconcile Account')}
  </button>
) : null}
```

Thread `onReconcileAccount` through `ChannelCard` → `AccountRow`.

- [ ] **Step 3: Verify**

Bank/Mobile Money rows show **Reconcile Account**; Cash does not.

- [ ] **Step 4: Commit**

```bash
git add app/payments/page.js components/payments/PaymentChannelsPanel.jsx
git commit -m "feat(payments): Reconcile Account CTA for Bank and Mobile Money"
```

---

### Task 4: Guided wizard shell + statement step

**Files:**
- Create: `app/payments/reconcile/[paymentAccountId]/page.js`
- Create: `components/payments/reconcile/ReconcileWizard.jsx`
- Create: `components/payments/reconcile/StatementStep.jsx`
- Create: `components/payments/reconcile/reconApi.js` (thin fetch helpers)

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/reconciliations`
- Consumes: `GET /api/bank-reconciliation/reconciliations?paymentAccountId=`
- Consumes: `GET /api/bank-reconciliation/accounts`
- Produces: open/create recon → `reconciliationId` for later steps

- [ ] **Step 1: API helper**

`components/payments/reconcile/reconApi.js`:

```js
export async function reconFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export function listReconciliations(paymentAccountId) {
  return reconFetch(
    `/api/bank-reconciliation/reconciliations?paymentAccountId=${encodeURIComponent(paymentAccountId)}`
  );
}

export function createReconciliation(body) {
  return reconFetch('/api/bank-reconciliation/reconciliations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: StatementStep**

Form fields: period start, period end, opening balance, closing balance.  
On submit:

1. `listReconciliations` — if any status in open set, offer Continue (set active id).
2. Else `createReconciliation({ paymentAccountId, statementDate: periodEnd, periodStart, periodEnd, statementOpeningBalance, statementClosingBalance })`.

- [ ] **Step 3: Wizard shell**

`ReconcileWizard.jsx` holds step index + `reconciliationId` + workspace refresh.  
Page loads account name from `/api/bank-reconciliation/accounts` (filter by id) or payment-accounts API.

Steps array: `statement | import | match | resolve | complete`.

- [ ] **Step 4: Smoke**

Navigate from CTA → statement form creates/resumes recon.

- [ ] **Step 5: Commit**

```bash
git add app/payments/reconcile components/payments/reconcile
git commit -m "feat(payments): guided reconcile wizard shell and statement step"
```

---

### Task 5: Import step (CSV / Excel)

**Files:**
- Create: `components/payments/reconcile/ImportStep.jsx`
- Modify: `components/payments/reconcile/reconApi.js`
- Modify: `components/payments/reconcile/ReconcileWizard.jsx`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/import/preview` (multipart)
- Consumes: `POST /api/bank-reconciliation/import/confirm`
- Accept: `.csv`, `.xlsx`, `.xls` only

- [ ] **Step 1: Wire preview/confirm**

Follow patterns in legacy `app/bank-reconciliation/page.js` (file input → FormData with `reconciliationId` + file → show preview rows → confirm).

Reject OFX in UI (`accept=".csv,.xlsx,.xls"` + client check on extension).

- [ ] **Step 2: On confirm success**

Advance wizard to Match; refresh workspace via `GET /api/bank-reconciliation/reconciliations/[id]`.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): CSV/Excel statement import in guided reconcile"
```

---

### Task 6: Match step (auto + manual 1:N)

**Files:**
- Create: `components/payments/reconcile/MatchStep.jsx`
- Modify: `reconApi.js`, `ReconcileWizard.jsx`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/reconciliations/[id]/auto-match`
- Consumes: `GET /api/bank-reconciliation/candidates?reconciliationId=`
- Consumes: `POST /api/bank-reconciliation/matches` body:
  `{ reconciliationId, statementIds: [id], bookLinks: [{ journalEntryLineId, amountMinor? }], notes? }`
- Consumes: match accept/reject actions under `/api/bank-reconciliation/matches/[id]/[action]` if suggestions need accept
- Displays: `guidedStatementStatusLabel` + outstanding list labeled **Outstanding**

- [ ] **Step 1: Layout**

Two columns (or stacked on mobile):

- Left: statement lines with status badges  
- Right: book candidates  

Actions: **Auto Match**, select bank + one/more books → **Match**.

Before POST manual match, client-check sums: `abs(bank.signedAmountMinor) === sum(selected book amounts)` (use workspace field names from API). If mismatch, show error with both totals — do not call API.

- [ ] **Step 2: Auto Match**

```js
await reconFetch(`/api/bank-reconciliation/reconciliations/${id}/auto-match`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
```

Then refresh workspace; show toast with `matchesCreated` if returned.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): auto and manual match in guided reconcile"
```

---

### Task 7: Resolve — create Expense / Money in

**Files:**
- Create: `components/payments/reconcile/ResolveStep.jsx`
- Modify: `reconApi.js`

**Interfaces:**
- Consumes: `POST /api/bank-reconciliation/adjust` with:
  ```js
  {
    reconciliationId,
    statementTransactionId,
    classification: 'BANK_CHARGE' | 'INTEREST', // expense vs money-in
    postAdjustment: true,
    offsetAccountId, // expense or income CoA
    description,
  }
  ```
- UI labels: **Create Transaction** → choose Expense (Bank charge) or Money in (Interest / other income)
- After success: refresh workspace (statement should link / classify)

- [ ] **Step 1: UI for unmatched bank rows**

For each unmatched statement line, button **Create Transaction** opens small form:

- Type: Expense | Money in  
- Offset account dropdown (fetch CoA expense/income accounts — reuse any existing accounts picker used on expense forms, or `/api/accounts` filtered)  
- Description (default statement description)  
- Submit → adjust API  

Map:

- Expense → `classification: 'BANK_CHARGE'`
- Money in → `classification: 'INTEREST'`

- [ ] **Step 2: Outstanding books**

List outstanding items from workspace; allow leave-as-is (no forced clear). Optional unmatch only if match id available via matches API.

- [ ] **Step 3: Commit**

```bash
git add components/payments/reconcile
git commit -m "feat(payments): create expense or money-in from unmatched bank lines"
```

---

### Task 8: Summary + Complete (difference === 0)

**Files:**
- Create: `components/payments/reconcile/SummaryStep.jsx`
- Modify: `ReconcileWizard.jsx`, `reconApi.js`

**Interfaces:**
- Consumes: workspace calculation from `GET .../reconciliations/[id]` (or POST `.../calculate`)
- Consumes: `POST /api/bank-reconciliation/reconciliations/[id]/complete`
- Complete button **disabled** unless `calculation.canComplete === true` OR `differenceMinor === 0` (use server fields; do not invent client plug)

- [ ] **Step 1: Summary strip (also sticky at top of wizard once recon exists)**

Show:

- Bank opening / closing  
- InsightBooks (book) balance  
- Total matched / unmatched / outstanding (from workspace counts)  
- Difference  
- Status text: if complete → Reconciled  

- [ ] **Step 2: Complete action**

```js
async function complete(id) {
  await reconFetch(`/api/bank-reconciliation/reconciliations/${id}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return reconFetch(`/api/bank-reconciliation/reconciliations/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: 'Guided reconcile complete' }),
  });
}
```

On success: read-only state + link back to `/payments`.

On failure (difference ≠ 0 or SoD): show server message.

- [ ] **Step 3: Unit test (client helper optional)**

If you extract `canCompleteFromWorkspace(workspace)`:

```js
export function canCompleteFromWorkspace(ws) {
  const calc = ws?.calculation?.calculation || ws?.calculation || {};
  if (typeof calc.canComplete === 'boolean') return calc.canComplete;
  return Number(calc.differenceMinor) === 0;
}
```

Test in `test/bankReconciliation.guidedEligibility.test.js`.

- [ ] **Step 4: Commit**

```bash
git add components/payments/reconcile test/bankReconciliation.guidedEligibility.test.js
git commit -m "feat(payments): reconcile summary and complete only at zero difference"
```

---

### Task 9: Reconciliation history on hub

**Files:**
- Modify: `app/payments/page.js` or create `components/payments/ReconciliationHistoryPanel.jsx`
- Modify: `components/payments/reconcile/ReconcileWizard.jsx` (list prior for account)

**Interfaces:**
- Consumes: `GET /api/bank-reconciliation/reconciliations?paymentAccountId=`

- [ ] **Step 1: History list**

Show recent reconciliations: period, closing, difference, status, completed by/at.  
Completed → open read-only wizard (`?id=` + lock steps).  
Open/draft → Continue.

- [ ] **Step 2: Commit**

```bash
git add app/payments/page.js components/payments
git commit -m "feat(payments): show reconciliation history on Accounts hub"
```

---

### Task 10: Regression + polish polish

**Files:**
- Touch only if broken: existing `test/bankReconciliation.*.test.js`
- Optional: remove dead imports from old power page if redirect left unused components

- [ ] **Step 1: Run full bank-rec suite**

```bash
npx vitest run test/bankReconciliation
```

Expected: all PASS. Fix any Cash-type fixtures that assumed Cash was reconcilable.

- [ ] **Step 2: Manual checklist**

1. Sidebar: only Accounts & Reconciliation  
2. `/bank-reconciliation` redirects  
3. Bank account → Reconcile → import sample CSV → Auto Match → create bank charge → Difference 0 → Complete  
4. Cash account has no Reconcile button  

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "test(bank-rec): guided reconcile regression green"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| Rename hub Accounts & Reconciliation | 2 |
| Remove/redirect Bank Reconciliation nav | 2 |
| Reconcile on Bank + Mobile Money only | 1, 3 |
| Guided route wizard | 4–8 |
| CSV/Excel import | 5 |
| Auto + manual 1:N match | 6 |
| Create Expense + Money in | 7 |
| Summary + Complete at difference 0 | 8 |
| History / read-only completed | 9 |
| SoD default off | 1 |
| Phase 10 reuse / no second ledger | all |
| Tests / regression | 1, 8, 10 |

**Out of scope (intentionally no task):** OFX UI, open banking, matching-rule admin, transfer create-missing, casual edit of completed without reopen.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-21-accounts-reconciliation-guided.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans checkpoints  

Which approach?
