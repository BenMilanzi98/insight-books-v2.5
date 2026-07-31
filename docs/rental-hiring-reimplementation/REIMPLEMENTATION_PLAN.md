# Reimplementation Plan — Rental & Hiring

**Prerequisite:** Approval of [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md).  
**Money:** `lib/money.js` + Decimal(18,2).  
**Posting:** Accounting V2 adapters only.

## Terminology cutover (Phase 0.5)

| Current | Future |
|---------|--------|
| `kind=rental` | Outbound serialised / space rental |
| `kind=hiring` (historical) | Outbound **quantity pool** (`QUANTITY_POOL`) — keep data, rename UI |
| New | Inbound **Supplier Hiring** (separate models) |

Do not rewrite historical invoice revenue into hire expense.

## Phases

| Phase | Name | Outcome |
|-------|------|---------|
| 0 | Audit (this pack) | Complete |
| 0.5 | Domain rename + docs | Operators understand modes |
| 1 | Foundation | Decimal, locks, idempotency keys, stop unsafe auto-complete |
| 2 | Catalogue + Units + Asset/Product links | Offering/Unit master |
| 3 | Availability engine + concurrency tests | No overbook |
| 4 | Rate plans + pricing engine | Versioned, Decimal, explanation |
| 5 | Quotation + Reservation + holds | No journals |
| 6 | Contracts + state machine | Commands only |
| 7 | Deposits + accounting | Liability correct |
| 8 | Dispatch + custody + consumables | No false COGS/disposal |
| 9 | Returns + inspections + damage + late fees | Idempotent charges |
| 10 | Billing engine + revenue policies | Period uniqueness |
| 11 | Customer payments / cancel / credit notes | No re-revenue |
| 12 | Inbound Hire Request → Agreement | No expense on order |
| 13 | Hire delivery/usage/matching/accrual/prepaid | Expense once |
| 14 | Supplier payments + deposits | AP clear only |
| 15 | Dashboards + detail UIs | Responsive |
| 16 | Reconciliation + reports | GL drill-down |
| 17 | Permissions, SoD, audit, notifications | Governance |
| 18 | Tests + build + readiness | Evidence |

## Phase 1 — Foundation (first code)

1. Add `FOR UPDATE` / unique overlap strategy for serialised units.  
2. Booking `idempotencyKey` unique per tenant.  
3. Disable or gate `releaseExpiredRentals` auto-complete (require explicit return).  
4. Decimal migration for rental money columns.  
5. Feature flag: `RENTAL_POST_INVOICE_ON_BOOK` (default off for new tenants).  

## Exit criteria (programme)

Critical+High gaps closed or deferred with owner; posting matrix implemented; concurrency + billing + deposit + hire expense tests green; TB scenarios pass; FINAL_READINESS_DECISION signed.

## Non-goals (until later)

- Full lease IFRS capitalisation (route to Assets & Liabilities)  
- Cosmetic redesign of all HR/other modules  
- Mobile kiosk polish before calc/accounting correctness  

## Go / No-go gates

| Gate | Criteria |
|------|----------|
| Start Phase 1 | Gap register + this plan approved |
| Start Phase 10 billing | Contracts + deposits + dispatch policies decided |
| Start Phase 13 hire expense | Hire usage approval exists |
| Production claim | Critical+High closed; tests green; reconciliations pass |
