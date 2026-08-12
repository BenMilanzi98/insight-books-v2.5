# Design: Rentals & Hiring — three hubs + invoice/reverse guarantees

**Date:** 2026-08-11  
**Status:** Approved (Approach 2)  
**Related:** `docs/rental-hiring-reimplementation/*` (domain audits; this spec is the operator-facing product slice)

## Goal

Make Rentals & Hiring easy to use with exactly three sidebar options — **Rentals**, **Hirings**, **Reports** — while guaranteeing that outbound billable work creates real Customer Invoices on `/invoices`, that reverse frees dates/time and restocks items atomically, and that revenue, tax, reversals, damages (loss), and repairs (expenditure) are traceable in one combined Reports hub.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Sidebar | Rentals · Hirings · Reports only |
| Rentals scope | Spaces / rooms / venues only (`kind=rental`) |
| Hirings | One workspace: **Customer hire** + **Supplier hire** tabs |
| Contracts V2 / Quotations V2 / Rental reconcile | Hidden from operators; deep links only |
| Reports | One combined hub (outbound + inbound metrics) |
| Approach | Hubs + hard guarantees on invoice & reverse (reuse engines; no full V2 rewrite) |

## Current baseline (gaps this closes)

- Sidebar has six items; “Quantity rentals” vs “Supplier hiring” confuses operators.
- Cancel path (`POST /api/rentals/cancel`) only allows **draft** invoices, deletes the invoice, restocks `kind=rental` assets, and does **not** clearly free availability rows / quantity capacity for all modes in one documented reverse flow.
- Posted invoices require manual void from Invoicing before operational cleanup — operators need a guided reverse that still ends with free slots + restock.
- Damages / repairs / reverse journals are not consistently tagged for a Rentals+Hirings report surface.

## Navigation

| Label | Route | Notes |
|-------|--------|-------|
| Rentals | `/rentals` | Spaces-only UI (`RentalsClient` mode rental / space assets) |
| Hirings | `/rentals/hirings` | Tabbed shell: `?tab=customer` \| `?tab=supplier` |
| Reports | `/rentals/reports` | Combined analytics |

**Redirects (keep old URLs working):**

- `/rentals/hiring` → `/rentals/hirings?tab=customer`
- `/rentals/inbound-hiring` → `/rentals/hirings?tab=supplier`

**Removed from sidebar (routes remain for power users):**

- `/rentals/contracts-v2`
- `/rentals/quotations-v2`
- `/rentals/reconcile`

**Permissions:** keep `rentals.view` / `rentals.create` / `rentals.update` / `rentals.delete` for hubs; invoice payment stays under invoice permissions.

## Hub: Rentals (spaces)

### Features that belong here

- Manage space/room/venue assets (`RentalAsset.kind = rental`)
- Calendar / datetime booking against a client
- Create billable booking → **Customer Invoice** linked 1:1 (or explicit invoice link) with source tag `RENTAL_SPACE`
- Status lifecycle: booked → active → completed \| reversed/cancelled
- Record damage on return (charge) and link repair spend to the asset/booking
- Deep link to invoice on `/invoices` for payment

### Features that do not belong here

- Quantity-pool equipment hire (Customer hire tab)
- Supplier hire agreements / AP bills
- Contracts V2 / Quotations V2 primary UX

## Hub: Hirings

### Tab A — Customer hire (outbound quantity pool)

- Manage pool assets (`kind` / quantity-pool outbound; today’s `/rentals/hiring`)
- Book against capacity for dates/times → **Customer Invoice** with source tag `CUSTOMER_HIRE`
- Appear on `/invoices` for payment recording
- Reverse: free reserved quantity **and** release availability windows; restock pool
- Damages / repairs same tagging as spaces

### Tab B — Supplier hire (inbound)

- Hire requests / agreements / usage / supplier bills (today’s inbound hiring V2)
- Financial effects: hire **expense**, AP, prepaid, supplier deposit **asset** — **never** Customer Rental Revenue
- No customer invoice creation from this tab
- “Return / end hire” closes operational period; does not restock owned outbound pools

## Invoice guarantee (outbound only)

For every billable space rental or customer hire:

1. Persist a real `Invoice` row visible under `/invoices`.
2. Stamp invoice (or rental transaction) with a stable source discriminator:
   - `RENTAL_SPACE` — space booking
   - `CUSTOMER_HIRE` — quantity-pool customer hire
3. Optional `/invoices` filter or badge by source (nice-to-have in same delivery if cheap; otherwise Reports + booking deep-link is enough for v1).
4. Payments **only** through existing invoice payment APIs/UI — no second cash path in Rentals/Hirings.
5. Idempotent book: retries must not create duplicate invoices for the same booking intent.

**Supplier hire:** must not create customer invoices.

## Reverse / cancel guarantee (outbound)

Single orchestrated reverse action (API + UI) that is **atomic** and **idempotent**:

1. Load booking + linked invoice + items + availability + quantity reservations.
2. If already cancelled/reversed → return success with same outcome (no double restock, no second void).
3. Invoice handling:
   - **Draft** → delete or void-as-draft per existing invoice rules; clear AR draft.
   - **Posted unpaid** → void invoice (existing void path that reverses GL revenue + tax).
   - **Paid / partially paid** → block operational reverse until credit note / refund path completes (guided message linking to Invoicing); do not free stock while paid revenue remains unrecovered.
4. In the same DB transaction after invoice is safely unwound (or draft deleted):
   - Mark `RentalTransaction` cancelled (or equivalent status).
   - Delete/release `RentalAssetAvailability` (and any unit allocations) for the booking.
   - Restock: set space assets `available`; restore quantity-pool available qty.
5. Write audit / accounting event tags for Reports (`REVERSAL`).

**Must free:** booking dates/times (availability) **and** rented/hired item capacity.  
**Must not:** leave orphan availability holds or negative pool qty after reverse.

## Damages (loss) and repairs (expenditure)

| Event | Operator entry | Accounting classification | Trace key |
|-------|----------------|---------------------------|-----------|
| Damage charge to customer | Return / inspection charge | Loss recovery revenue and/or damage income per CoA matrix; AR if invoiced | `DAMAGE` + booking/charge id |
| Unrecoverable damage write-off | Explicit loss action | Loss / expense (not rental revenue) | `DAMAGE_LOSS` |
| Repair spend | Expense (or linked repair record) against asset/booking | Expenditure (expense + tax rules) | `REPAIR` + expense/journal id |
| Reverse of booking | Reverse flow above | Reversal of original revenue + tax | `REVERSAL` |

Prefer reusing `RentalCharge` / existing expense + journal posting where present; require `sourceModule` + `sourceId` on journals (or invoice metadata) so Reports can aggregate without double count.

## Accounting rules (summary)

Aligned with `RENTAL_HIRING_ACCOUNTING_POSTING_MATRIX.md`:

- Outbound invoice: Dr AR · Cr Rental Revenue · Cr Output Tax
- Customer payment: Dr Cash/Bank · Cr AR (never re-credit revenue)
- Reverse/void/credit: reverse original revenue + tax once (idempotent)
- Damage: separate charge id; deposit forfeit only if deposit liability exists
- Repair: expense, not COGS of reusable capital assets
- Supplier hire bill: Dr Hire Expense (+ input tax) · Cr AP
- Supplier payment: Dr AP · Cr Cash (never re-expense)

## Hub: Reports

Route: `/rentals/reports`

### Filters

- Date range
- Branch (if multi-branch)
- Type: All · Space rental · Customer hire · Supplier hire

### Panels / metrics

1. **Revenue** — outbound invoiced revenue (net of credits/voids as configured)
2. **Tax** — output tax on outbound rental/hire invoices
3. **Reversals** — voided/credited amounts + count
4. **Damages / loss** — damage charges and write-offs
5. **Repairs / expenditure** — repair-linked expenses
6. **Utilization** — space hours booked vs available; customer-hire qty-days
7. **Supplier hire spend** — expense/AP hire bills (separate from revenue)

Drill-down: link rows to booking, invoice, or journal. Export CSV/XLSX optional in v1 if existing export helpers exist.

Data sources: tagged invoices + journals + rental transactions + hire agreements/bills — prefer GL/invoice truth over UI-only aggregates.

## Error handling

| Case | Behavior |
|------|----------|
| Overlapping space booking | Reject before invoice |
| Insufficient quantity | Reject before invoice |
| Reverse already done | Idempotent success |
| Reverse with paid invoice | Block + guide to credit/refund then reverse |
| Reverse with posted unpaid | Void invoice then free slots/stock |
| Supplier hire book | No customer invoice |
| Missing permission | 403 |

## UI / theming

Follow existing tenant glass / POS-style page headers used elsewhere (`PosStylePageHeader` / panels) for `/rentals`, `/rentals/hirings`, `/rentals/reports` so the three hubs feel consistent with recent module restyles. Do not invent a new visual system.

## Out of scope (v1)

- Full Contract/Quotation V2 rewrite or promoting those into the sidebar
- Changing general Invoicing layout beyond source badge/filter if cheap
- Auto-capitalising hired-in gear into owned assets
- Reworking deposit liability product if not already present (document gap; do not invent deposit UX in this slice unless reverse/damage requires it)

## Implementation shape (guidance for plan)

1. Sidebar + redirects + Hirings tab shell  
2. Harden outbound book → invoice source tags + `/invoices` visibility check  
3. Harden reverse API (void + free availability + restock, idempotent)  
4. Damage/repair tagging hooks  
5. Reports API + page  
6. Regression tests: book→pay path; reverse frees slots/qty; supplier hire never posts customer revenue  

## Success criteria

- Operators see only three Rentals & Hiring menu items.
- Space rental and customer hire invoices appear on `/invoices` and accept payment there.
- Reverse of outbound booking frees dates/times and restocks items; second reverse is safe.
- Reports show revenue, tax, reversals, damages/loss, repairs/spend, utilization, and supplier hire spend without mixing supplier expense into customer revenue.
- Supplier hire creates expense/AP only.

## Self-review notes

- No unresolved placeholders.
- No conflict with locked decisions (spaces-only Rentals; Hirings dual-tab; Approach 2).
- Paid-invoice reverse is gated (credit first) — intentional to avoid silent restock with unrecovered revenue.
- Contracts/Quotations remain deep-link only — intentional per decision C.
