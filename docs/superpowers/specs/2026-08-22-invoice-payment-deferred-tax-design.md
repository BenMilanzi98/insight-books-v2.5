# Wave A — Invoice Payment Posting & Deferred Full Tax Design

**Date:** 2026-08-22  
**Status:** Approved (brainstorm)  
**Approach:** Fix payment posting + deferred tax hook; keep existing adapters/orchestrator (Approach 1)  
**Surface:** Invoice customer payments (API + existing payment UIs); dashboard receivables/cash consumers  
**Parent program:** Accounting / Reporting / Budgeting improvements (Waves A→E)

---

## 1. Purpose

When a customer pays an invoice (partially or in full):

1. Invoice status, AR, and cash/bank must update correctly and show on the dashboard without stale figures.
2. **Invoice output tax** (VAT / invoice `taxAmount`) must **not** hit the GL on partial payments.
3. When the invoice becomes **Paid**, post the **full** invoice tax **once**.
4. Revenue recognition on partials stays **as InsightBooks behaves today** — this slice only changes tax timing and fixes payment → dashboard/AR/cash truth.

This does **not** rewrite the payment orchestrator, change cash-basis vs accrual policy beyond tax deferral, or address bills / loans / CoA merges (later waves or follow-up specs).

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| Implementation approach | **Approach 1** — fix payment posting + deferred tax hook; keep adapters |
| Tax timing | **On Paid only** — no tax GL until the payment that marks invoice Paid; then full `invoice.taxAmount` once |
| Revenue on partials | **Keep today’s behavior** (no change in this slice) |
| Dashboard | Must reflect posted cash and reduced AR after payment (fix stale/cache paths) |
| Bills 2nd partial / closed-period 500 / loan schedule lock | **Out of scope** — separate follow-up specs |
| Feature flag | Not required by default; dual-path cleanup only if needed during plan |
| Legacy Partially Paid with prior partial tax | No auto-repair in this slice; note for Wave B / cleanup if discovered |

---

## 3. Architecture & payment flow

### 3.1 Keep existing entry points

Continue to use current routes and adapters, including:

- Invoice / customer payment APIs
- Partial-payment paths
- Mark-paid paths
- `customerPaymentAdapter` (and related V2 posting)
- Existing payment-time revenue recognition (`ensureInvoicePaymentRevenueRecognition` and related)

Do **not** introduce a second payment ledger or a parallel orchestrator.

### 3.2 Post-success sequence (conceptual)

After a successful payment cash/AR post:

1. Update invoice `amountPaid` / status (**Partially Paid** / **Paid**) as today.
2. Run **current** revenue recognition for that payment (unchanged).
3. **Tax hook:**
   - If invoice is **not** Paid → **do not** post output VAT / invoice tax liability (and do not partially accrue tax on that payment).
   - If this payment makes status **Paid** → post **full** `invoice.taxAmount` once to the correct VAT/tax payable (and related) accounts.
4. **WHT** deducted on a receipt (customer withholding), if used today, remains **payment-level** behavior unless it is the same “invoice output tax” path. **Invoice output tax** is what waits until Paid.

### 3.3 Dashboard / AR / cash

After payment, dashboard receivables, cash, and related metrics must include this payment without requiring a brittle hard refresh. Prefer sources that already reflect:

- Posted PaymentAccount / CoA cash balances
- Invoice remaining balances including this payment
- Posted journals from the payment path

Fix any consumer that caches pre-payment totals or ignores V2 journals when those are the source of truth for the metric.

### 3.4 Idempotency

“Full tax on Paid” uses a **single posting key per invoice** (e.g. source type such as `Invoice-Tax` + `invoiceId`). Replaying the final payment, mark-paid, or retries must **not** duplicate tax.

---

## 4. Edge cases & errors

### 4.1 Zero / no tax

If `invoice.taxAmount` is 0 (or there are no taxable amounts to post): on Paid, **skip** tax GL. No empty journal. Payment + revenue behave as today.

### 4.2 Single payment that fully pays

Same as a final partial: one cash/AR post, revenue as today, **and** full tax in the same success path (still one idempotent tax journal keyed by invoice).

### 4.3 Overpayment

Keep **today’s** overpayment rules (reject or credit as already implemented). Do not invent a new overpay model in this slice. Tax still fires only when status becomes **Paid** under existing rules — never from “extra cash” alone.

### 4.4 Partials that never reach Paid

Tax stays off the books until Paid. AR and cash still move with each partial.

### 4.5 Voids / payment reversals

| Situation | Behavior |
|-----------|----------|
| Reverse a **partial** (invoice not Paid) | Reverse that payment’s cash/AR (and any revenue recognition for that payment). Tax was never posted → nothing to reverse for tax. |
| Reverse a payment that had made the invoice **Paid** (or void after Paid) | Reverse that payment’s cash/AR/revenue **and** reverse the full tax journal if it exists. Invoice returns to Partially Paid / Unpaid per remaining payments. Tax re-posts only if the invoice becomes Paid again later. |

Prefer existing reversal/void machinery; add tax reverse only where the Paid tax journal was created.

### 4.6 Failed / closed period / permission

- If cash/AR (or revenue) post fails → invoice must **not** flip to Paid and tax must **not** post.
- If Paid flip succeeds but tax post fails → **hard failure** for that request: rollback or compensating reverse of the payment in the same transaction where possible. Do **not** leave “Paid with missing tax.”
- Surface a clear error when the reason is known (avoid opaque 500s for known closed-period / permission failures on this path).

### 4.7 Idempotent retries

If a posted tax journal for that invoice already exists, skip recreate.

---

## 5. Testing & rollout

### 5.1 Automated tests (required)

1. **Partial payment:** cash/AR (+ today’s revenue) post; **no** invoice tax journal; invoice Partially Paid; AR remaining / dashboard-relevant remaining correct.
2. **Final payment → Paid:** cash/AR + revenue as today; **one** full-tax journal for `invoice.taxAmount`; idempotent on replay.
3. **Zero-tax invoice Paid:** no tax journal.
4. **Reverse final payment after Paid:** tax journal reversed; invoice not Paid.
5. **Closed-period / post failure:** invoice not Paid; no orphan tax.

### 5.2 Manual smoke

Pay an invoice in two steps on a real branch; confirm dashboard receivables/cash, CoA VAT liability only after the second payment, and invoice status transitions.

### 5.3 Rollout

- Ship with normal deploy (no feature flag unless a risky dual-path appears during implementation).
- Invoices already **Paid** with tax already posted: leave as-is (idempotency skips).
- Partially Paid invoices with any **legacy partial tax**: no auto-repair in this slice.

### 5.4 Explicit non-goals (follow-ups)

- Bills second partial payment correctness
- Closed accounting period returning a clear non-500 error (broader than this path if needed)
- Loan schedule lock after paid
- Waves B–E (tax CoA cleanup, purchases/stock, reporting/governance, budgeting)

---

## 6. Success criteria

- Partial invoice payments update AR/cash and dashboard without posting invoice output tax.
- Becoming Paid posts full invoice tax exactly once.
- Revenue on partials unchanged from current InsightBooks behavior.
- Reversal after Paid reverses tax; partial reversal does not invent tax reverses.
- Failures never leave Paid without the required tax journal (or leave tax without Paid).

---

## 7. Implementation notes (for planning)

Primary touchpoints expected during planning (non-exhaustive):

- Customer / invoice payment APIs and adapters (e.g. `customerPaymentAdapter`)
- Payment-time revenue recognition (`ensureInvoicePaymentRevenueRecognition` and posters)
- Any existing tax-on-payment hooks that currently post or prorate tax before Paid — gate or move to Paid-only full post
- Dashboard / receivables / cash-flow consumers that may lag after V2 posts
- Reversal paths for invoice payments

Exact file list and task breakdown belong in the implementation plan, not this design.
