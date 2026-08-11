# Invoice Cash-Basis Revenue + Instant COGS — Design Spec

**Date:** 2026-08-10  
**Surface:** Invoice create / finalize, invoice payments, Dashboard & P&L revenue/COGS  
**Status:** Approved for implementation

## Locked decisions

| Decision | Choice |
|----------|--------|
| Revenue recognition | **Cash / payment basis** — Sales Revenue hits P&L only when payments are recorded |
| Invoice-create AR | **Approach A** — post AR at create against Deferred Revenue (not Sales Revenue) |
| VAT on issue | **Yes** — `Cr VAT Output` on invoice date (tax-invoice compliance) |
| COGS | **Instant** on non-draft invoice create / finalize (stocked items only) |
| Partial payments | Pro-rata recognition of Deferred Revenue → Sales Revenue |
| Existing invoices | **Leave as-is** — no automatic rewrite of already-posted `Cr Sales Revenue` |
| Draft / Proforma | No GL (unchanged) |

## Goals

1. Creating or finalizing an invoice must **not** credit Sales Revenue.
2. Recording invoice payments must **recognize** Sales Revenue for the paid share.
3. Cost of goods for inventory lines must post **immediately** when the invoice leaves Draft.
4. Accounts Receivable on the balance sheet must still match unpaid invoice totals.
5. Dashboard / income-statement **revenue** follows collected Sales Revenue; **COGS** follows invoice-date Invoice-COGS.

## Non-goals

- Rewriting historical journals that already credited Sales Revenue at issue.
- Changing POS cash-sale recognition (POS remains point-of-sale revenue).
- Changing expense or supplier payment posting.
- Building a full deferred-revenue subledger UI (mapping + postings only).

## Accounting model

### On non-draft invoice create / Draft → Pending|Partial|Paid finalize

**Journal A — Invoice issue (receivable + deferral + VAT)**  
Source type: `Invoice` (reuse); template behaviour changes.

| Line | Account purpose | Side | Amount |
|------|-----------------|------|--------|
| 1 | `ACCOUNTS_RECEIVABLE` | Dr | Invoice `total` |
| 2 | `DEFERRED_REVENUE` (new purpose) | Cr | `total − taxAmount` (net) |
| 3 | `VAT_OUTPUT` (if tax > 0) | Cr | `taxAmount` |

**Journal B — COGS (unchanged timing)**  
Source type: `Invoice-COGS`.

| Line | Account purpose | Side | Amount |
|------|-----------------|------|--------|
| 1 | `COST_OF_SALES` | Dr | Calculated COGS |
| 2 | `INVENTORY` | Cr | Same |

Stock deduction + inventory transaction remain tied to Journal B (idempotent via existing `ensureInvoiceSalesAccounting` COGS path).

### On each completed invoice payment

**Journal C — Cash application (existing)**  
Source type: `Payment`.

| Line | Account | Side | Amount |
|------|---------|------|--------|
| 1 | Cash/Bank (payment method) | Dr | Payment amount |
| 2 | `ACCOUNTS_RECEIVABLE` | Cr | Payment amount |

**Journal D — Revenue recognition (new)**  
Source type: e.g. `Invoice-Revenue` (or `Payment-Revenue`); one per payment; idempotent on `paymentId`.

| Line | Account purpose | Side | Amount |
|------|-----------------|------|--------|
| 1 | `DEFERRED_REVENUE` | Dr | Recognized **net** revenue for this payment |
| 2 | `SALES_REVENUE` | Cr | Same |

**Pro-rata net recognition**

```
recognizedNet = roundMoney( paymentAmount * (invoiceNet / invoiceTotal) )
```

where `invoiceNet = total − taxAmount`, `invoiceTotal = total`.

- Last payment (or when remaining balance ≤ tolerance): recognize **remaining** deferred balance for that invoice (avoid cent drift), not a fresh multiply.
- Tax was already credited to VAT Output at issue; payments do **not** re-split VAT into P&L revenue.

### Void / refund / reverse (out of detailed scope, constraints)

- Invoice void/reverse that reverses `Invoice` must reverse Deferred Revenue (and VAT), not Sales Revenue, for invoices posted under this model.
- Payment reversal must reverse both Journal C and Journal D for that payment.
- Implementers must extend existing reversal helpers to reverse the new recognition journal; do not leave orphan Deferred Revenue.

## Chart of accounts / purposes

Add system purpose **`DEFERRED_REVENUE`**:

- Category: Liability  
- Normal balance: Credit  
- Suggested legacy / blueprint code: **`2150`** (Current liability leaf; name “Deferred Revenue” / “Unearned Revenue”)  
- Ensure purpose mapping readiness / template apply can resolve it (same pattern as `VAT_OUTPUT`, `SALES_REVENUE`)

Tenants missing the leaf: resolve via purpose mapping with create-if-missing on first post (follow existing purpose-resolution patterns; fail closed with a clear error if mapping cannot be created).

## Application flow changes

| Entry point | Behaviour |
|-------------|-----------|
| `POST /api/invoices` (non-draft) | Post Journal A + Journal B. **Do not** credit Sales Revenue. |
| `PUT/PATCH` invoice leaving Draft | Same as create finalize. |
| `POST /api/invoices/partial-payment` (and mark-paid) | Ensure Journal A+B if somehow missing (repair), then Journal C + Journal D. **Do not** call full accrual `postInvoiceAccounting` that credits Sales Revenue. |
| Dashboard / P&L | No special cash filter required once Sales Revenue only moves on payment; keep V2 COGS netting. |

Refactor `ensureInvoiceSalesAccounting`:

- Rename/clarify: **ensure invoice issue accounting** = AR + Deferred Revenue + VAT + COGS (no Sales Revenue).
- Payment path: **ensure payment revenue recognition** = Journal D after Journal C.
- Remove “force post full Sales Revenue on first payment”.

## Idempotency

| Journal | Key |
|---------|-----|
| A | `Invoice` + `invoiceId` |
| B | `Invoice-COGS` + `invoiceId` |
| C | `Payment` + `paymentId` (existing) |
| D | `Invoice-Revenue` (or chosen sourceType) + `paymentId` |

## Reporting / Dashboard

- **Total / Today’s Revenue:** GL Sales Revenue (and operational payment fallback already sums completed payments — remains aligned).
- **COGS:** Invoice-COGS / Sale-COGS on invoice/sale date (already fixed for V2).
- **AR (financial position):** Control account 1200 — still correct under Approach A.
- Deferred Revenue liability may appear on BS; optional KPI later (not required for this change).

## Migration / coexistence

- Invoices already posted with `Cr Sales Revenue` at issue: **no backfill**.
- Detection: if an invoice has posted `Invoice` lines crediting `SALES_REVENUE` (legacy model), payment Journal D must **skip** recognition for that invoice (AR settlement only) to avoid double revenue.
- New invoices: `Invoice` credits `DEFERRED_REVENUE` only.

## Testing (acceptance)

1. Create Pending inventory invoice → Product Sales unchanged; Deferred Revenue + AR + VAT + Invoice-COGS posted; stock down.  
2. Partial payment → Cash up; AR down; Deferred Revenue down; Product Sales up by pro-rata net.  
3. Final payment → Deferred Revenue for that invoice ≈ 0; cumulative Product Sales net = invoice net.  
4. Service-only invoice → no Invoice-COGS; revenue still only on payment.  
5. Draft invoice → no journals until finalize or (if product allows pay-on-draft) payment path posts A+B then C+D.  
6. Legacy invoice (Sales Revenue already at issue) → payment does not post Journal D.  
7. Dashboard revenue for the day equals sum of payment-recognized net revenue (plus POS), not unpaid invoice totals.

## Risks

| Risk | Mitigation |
|------|------------|
| Double revenue on mixed old/new invoices | Skip Journal D when issue journal already credited Sales Revenue |
| Cent drift on partials | Last-payment remaining deferred balance |
| Missing Deferred Revenue account | Purpose resolve + create leaf 2150 / fail closed |
| Void/refund orphans | Extend reversal to cover Journal D and Deferred Revenue on Invoice reverse |

## Spec self-review

- No placeholders / TBD left for locked decisions.  
- Consistent: revenue on payment; COGS on issue; AR via deferred liability; VAT on issue.  
- Scope limited to invoice issue + payment recognition + purpose/template/adapters + tests; no POS rewrite; no historical mass rewrite.
