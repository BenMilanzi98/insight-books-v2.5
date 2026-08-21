# Accounts & Reconciliation — Guided Bank Reconciliation Design

**Date:** 2026-08-21  
**Status:** Approved (brainstorm)  
**Approach:** Integrate & simplify Phase 10 Bank Reconciliation into Payment Accounts (Approach 1)  
**Surface:** `/payments` → `/payments/reconcile/[paymentAccountId]`  
**Backend:** Existing Phase 10 `lib/bankReconciliation/*` + `/api/bank-reconciliation/*` (no second ledger)

---

## 1. Purpose

Let a business compare **bank/mobile-money statement lines** with **InsightBooks Payment Account activity** so they can:

- See matches
- Spot bank lines missing in InsightBooks
- Spot InsightBooks lines not yet on the bank
- Drive **Difference** to **exactly MK 0** and mark the period reconciled

This does **not** create a separate accounting system. It compares statement evidence to existing Payment Accounts, expenses, receipts, invoices, and GL activity.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Existing Phase 10 | **Reuse** models, matching, import parsers, complete/snapshot |
| Navigation | Single entry **Accounts & Reconciliation** → `/payments`; remove separate Bank Reconciliation nav; `/bank-reconciliation` redirects |
| UI shape | Guided route `/payments/reconcile/[paymentAccountId]` (not embed-in-page, not thin restyle of power UI) |
| Reconcile button | `accountType` **Bank** or **Mobile Money** only — not Cash / POS / Wallet / other in v1 UI |
| Statement formats (v1 UI) | **CSV** + **Excel** only (OFX stays out of guided UI) |
| Create missing | **Expense** + **Money in** (other income / receipt-style) |
| Complete | Hard block unless **Difference === 0** |
| SoD | Guided path defaults `requireSeparateApprover = false` so one user can prepare and complete |
| Open banking | Out of scope (later) |

---

## 3. Placement & navigation

1. Rename sidebar **Payment Accounts** → **Accounts & Reconciliation** (href remains `/payments`).
2. Remove Accounting submenu item **Bank Reconciliation** (or stop listing it).
3. `/bank-reconciliation` → redirect to `/payments` (or to `/payments/reconcile/[id]` when `paymentAccountId` query is present).
4. On `/payments`, each eligible account card/row shows balance + **Reconcile Account**.
5. Ineligible types (Cash, Wallet, POS Terminal, etc.) remain manageable without a Reconcile action.

i18n: update `navigation.paymentAccounts` / related keys to the new label; keep route permissions (`payments.view` for hub; `bankReconciliation.*` for recon actions).

---

## 4. Guided reconcile workspace

**Route:** `/payments/reconcile/[paymentAccountId]`  
**Optional query:** `?id=<reconciliationId>` to resume an open draft.

### 4.1 Flow (linear)

```
Statement details → Import CSV/XLSX → Auto/Manual match → Resolve → Summary → Complete
```

### 4.2 Step — Statement

User confirms:

- Payment account (pre-selected from route)
- Statement period (`periodStart` / `periodEnd`)
- Opening balance
- Closing balance

System creates or resumes `BankRecReconciliation` via existing create/list APIs.  
**InsightBooks balance** = posted book balance for the linked CoA as of statement date (`bookBalanceMinorAsOf`).

If an open reconciliation already exists for the account: offer **Continue** that draft (do not silently create a parallel open recon unless explicitly allowed by API flag — guided UI does not use parallel opens).

### 4.3 Step — Import

- Upload CSV or Excel → preview → confirm (existing import preview/confirm).
- Map statement rows into `BankRecStatementTransaction`.
- Re-import allowed only while reconciliation is open and not completed.
- OFX not offered in this UI.

### 4.4 Step — Match

**Statuses (simple labels in UI):**

| UI label | Meaning |
|----------|---------|
| Matched | Bank line linked to one or more book lines |
| Unmatched bank | On statement; not in InsightBooks (or not linked yet) |
| Outstanding | In InsightBooks; not on this statement (yet) |

**Auto Match:** prefer exact amount + date; then reference, description, customer/vendor / payee (existing matching service). Present suggestions for user review/accept.

**Manual Match:** select one bank line + one or more book candidates → Match. Allow **1 bank : N books** when amounts sum correctly; block with clear totals if they do not.

### 4.5 Step — Resolve

- **Unmatched bank** → **Create Transaction**:
  - **Expense** (e.g. bank charges), or
  - **Money in** (other income / receipt)
  - Posted through existing payment-account / expense / income posting paths (prefer Phase 10 `classifyAndAdjust` / adjust API so statement line auto-links).
- **Outstanding books** → leave outstanding, or unmatch if wrongly matched.
- No parallel “adjustment-only” ledger that bypasses normal books.

### 4.6 Step — Summary & Complete

Always show:

- Bank opening balance  
- Bank closing balance  
- InsightBooks balance  
- Total matched  
- Total unmatched bank  
- Total outstanding  
- **Difference**  
- Status: Reconciled only after complete with difference 0  

**Complete Reconciliation:**

- Enabled only when server-calculated **Difference === 0** (hard block otherwise; show amount to investigate).
- Persists: payment account, period, opening/closing, reconciliation date, completer, matches, adjustments/created links, immutable snapshot (existing complete path).
- Completed reconciliations are **read-only** in v1 UI; reopen/reverse remains backend capability but is not a casual edit affordance.

---

## 5. Architecture

```
/payments (hub)
    └─ Reconcile Account
         └─ /payments/reconcile/[paymentAccountId]
                └─ calls /api/bank-reconciliation/*
                     └─ lib/bankReconciliation/application/*
                          └─ Prisma BankRec* + PaymentAccount + CoA journals
```

**Principle:** Statement rows are external evidence; matches link to book activity; create-missing posts real GL/PaymentAccount activity.

**Optional:** Thin aliases under `/api/payment-accounts/[id]/reconcile/*` are **not required** for v1; guided page may call `/api/bank-reconciliation/*` directly.

---

## 6. Permissions & eligibility

| Concern | Rule |
|---------|------|
| Hub | `payments.view` (existing) |
| Reconcile actions | `bankReconciliation.view` / `import` / `match` / `adjust` / `complete` as today |
| Missing recon perms | Show account without Reconcile, or disabled control with clear message |
| Account type (UI) | Reconcile only for **Bank** and **Mobile Money** |
| CoA link | Must have linked postable cash/bank CoA (existing assert); otherwise block with fix hint |

Backend may still list Cash in `RECONCILABLE_PAYMENT_TYPES`; **v1 UI does not expose Reconcile for Cash**.

---

## 7. Errors (user-facing)

| Situation | Behavior |
|-----------|----------|
| Bad/empty file or unmapped columns | Stay on import; row/column preview errors |
| Open recon exists | Continue draft |
| 1:N amount mismatch | Block Match; show bank vs books totals |
| Difference ≠ 0 | Complete disabled; show difference |
| Inactive / unlinked CoA account | Block start; explain how to fix |
| Feature disabled | Clear enablement message (existing feature flag path) |

---

## 8. History

On `/payments` and/or reconcile landing: list open + completed reconciliations for the account (period, closing, difference, status, completed by/at). Completed → read-only detail view.

---

## 9. Out of scope (v1)

- Direct bank connections / open banking  
- OFX in guided UI  
- Matching-rule admin screens  
- Multi-step approval UI (SoD remains optional via config, default off for guided path)  
- Transfer-as-create-missing type  
- Casual edit of completed reconciliations without reopen/reverse  
- Renaming URL `/payments` (label only)

---

## 10. Testing

1. **Unit:** Difference gate (complete only at 0); match priority; 1:N sum validation.  
2. **Integration:** CSV import → auto match → create expense from unmatched → complete.  
3. **UI:** Reconcile only on Bank/Mobile Money; nav rename; `/bank-reconciliation` redirect.  
4. **Regression:** Existing `test/bankReconciliation.*.test.js` suite still passes.

---

## 11. Implementation notes (for plan)

1. Nav + i18n rename; remove/redirect old recon entry.  
2. Add Reconcile CTA on `/payments` for eligible types.  
3. New guided page composing existing APIs (simplify labels/statuses to guide language).  
4. Ensure create-missing maps to Expense + Money in and auto-links statement line.  
5. Wire Complete button to server difference === 0 only.  
6. Default recon config `requireSeparateApprover` false for guided path / new configs.  
7. Keep Phase 10 power page unreachable via nav (redirect only) unless needed for support.

---

## 12. Success criteria

- User finds recon only under **Accounts & Reconciliation**.  
- From a Bank/Mobile Money account: upload statement → auto/manual match → create missing expense or money-in → difference 0 → Complete.  
- Difference and balances are server-authoritative; no duplicate ledger.  
- Existing Phase 10 backend tests remain green.
