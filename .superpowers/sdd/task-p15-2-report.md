# Task P15-2 Report — Wave 2 Price Books, pricing, tax/FX, discounts, approvals

**Task:** Wave 2 — Price Books, pricing, tax/FX, discounts, approvals (Phase 15)  
**Date:** 2026-07-31  
**Workspace:** `c:\laragon\www\insight-books-v2.5` (WORKING_TREE; dirty — not reset)  
**Status:** **DONE**

## Summary

Shipped CRM Price Books (ACTIVE versions/entries immutable), deterministic `calculateCommercialDocument` with immutable pricing snapshots and currency-explicit totals, in-platform tax (override requires approval), explicit FX gate (`FX_CONTEXT_MISSING` / `STALE` — never silent convert), discount policies/requests with threshold + SoD, pricing exceptions foundation, terms/clauses foundation, and commercial approval engine with material-change invalidation. Thin APIs/UI stubs. Vitest Wave 2 green. No git commit. No PDF/issue/delivery/acceptance/reports.

## TDD evidence

### RED (before implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave2.test.js
❯ test/systemAdmin.crm.commercialWave2.test.js (8 tests | 8 failed)
TypeError: createPriceBook is not a function
TypeError: createDiscountRequest is not a function
TypeError: submitCommercialDocumentForApproval is not a function
…
Test Files  1 failed (1)
     Tests  8 failed (8)
```

### GREEN (after implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave2.test.js
✓ ACTIVE Price Book version/entry is immutable (not silently edited)
✓ calculateCommercialDocument is deterministic and idempotent by key
✓ ZAR + USD line items are not silently summed
✓ missing FX context returns FX_CONTEXT_MISSING (never silent convert)
✓ tax override without approval fails
✓ 20% discount above 10% threshold stays PENDING until approved
✓ self-approve on commercial approval step is blocked (SoD)
✓ material qty change after full approval invalidates affected approvals

Test Files  1 passed (1)
     Tests  8 passed (8)
```

Wave 1 + Wave 2 combined: **15/15 passed**.

## Deliverables

| Area | Paths |
|------|--------|
| Lib | `lib/admin/crm/commercial/` — priceBooks, productConfig, lineItems, pricing, pricingSnapshot, currencyFx, tax, discounts, exceptions, terms, clauses, approvals (+ catalogue/model/numbering/index extensions) |
| Prisma | `CrmPriceBook` / Version / Entry, `CrmTaxRule` / `CrmTaxRateVersion`, `CrmDiscountPolicy` / Request, `CrmPricingException`, `CrmPricingSnapshot`, `CrmApprovalPolicy` / Request / Step / Decision, `CrmTerm`, `CrmClause` + Admin relations |
| SQL fallback | `scripts/sql/crm-commercial-phase15-wave2.sql` |
| APIs | `app/api/admin/crm/price-books/`, `discount-requests/`, `tax-rules/`, `commercial-approvals/` |
| UI stubs | `app/insightbooks/crm/price-books/`, `discount-requests/`, `tax-rules/`, `commercial-approvals/` |
| Exports | `lib/admin/crm/commercial/index.js` + `lib/admin/crm/index.js` |
| Test | `test/systemAdmin.crm.commercialWave2.test.js` |

## Interfaces implemented

- `createPriceBook` / `approvePriceBookVersion` / `activatePriceBookVersion` (ACTIVE immutable)
- `updatePriceBookEntry` (blocked when ACTIVE)
- `calculateCommercialDocument({ actorContext, commercialDocumentVersionId, priceBookVersionId, currency, lineItems, taxContext, discountRequests, pricingExceptions, calculationDate, idempotencyKey, fxContext? })` → `{ calculationId, snapshot, totals }`
- `createDiscountRequest` / `approveDiscountRequest`
- `submitCommercialDocumentForApproval` / `decideApprovalStep` (SoD)
- `applyMaterialDocumentChange` (invalidates APPROVED/PENDING approvals)
- Totals: `listSubtotal`, `netSubtotal`, `taxTotal`, `grandTotal`, `quotedMonthlyRecurring`, `quotedAnnualRecurring`, `firstYearTotal`, `totalContractValue` (currency-explicit)

## Acceptance checklist

- [x] Vitest Wave 2 PASS (8/8) with listed cases
- [x] ACTIVE Price Book versions immutable
- [x] calculateCommercialDocument deterministic + idempotent
- [x] Currency separation + FX gate
- [x] Discount/exception SoD
- [x] Approval invalidation on material change
- [x] No tenant tax/MRA side effects; no commit

## Hard-rule verification (self-review)

| Rule | Evidence |
|------|----------|
| ACTIVE Price Book immutable | `updatePriceBookEntry` fails when version ACTIVE; test asserts listPrice unchanged |
| No silent FX | Missing/mixed currency → `FX_CONTEXT_MISSING`; never fabricated combined total |
| Tax override needs approval | `resolveTaxContext` rejects `overrideApproved: false` |
| Discount threshold | 20% > 10% → PENDING; pending not applied to netSubtotal |
| Self-approve blocked | `decideApprovalStep` SoD when protected step + same requester |
| Material change invalidates | qty change → approval `INVALIDATED` |
| Opp estimates non-binding | Domain contract `opportunityEstimatesNonBinding: true`; pricing never reads Opp estimates |
| No Tenant tax / MRA EIS | Domain flags + snapshot `tenantTaxPosted: false` / `mraEisFiscalSubmitted: false` |
| No PDF/issue/acceptance | Not implemented (Wave 3) |
| No commit | Per instructions |

## Concerns

1. **Prisma generate / db push** not run here (Windows EPERM pattern) — apply `scripts/sql/crm-commercial-phase15-wave2.sql` + regenerate client when safe; `hasCrm*Model` guards degrade to UNAVAILABLE until then.
2. **UI stub i18n keys** may render as raw keys until locale strings are added (Wave 4 hubs acceptable).
3. **Approval policy seed** — tests mock `CrmApprovalPolicy` (`ap-1`); production needs an ACTIVE policy seed/migration row.
4. **TCV / first-year** foundation uses monthly×12 + one-time (+ annual lines); multi-year term length not yet a first-class input (acceptable for Wave 2 pricing spine).

## Commits

None (per instructions).

## Fix wave (Important)

Addressed Important review findings from `task-p15-2-review.md` (no git commit).

### Changes

1. **`resolveDiscountApplication` (discounts.js)** — Approval resolved exclusively from `CrmDiscountRequest` by id. Caller `status: 'APPROVED'` (with or without id) is never trusted; missing/unknown ids stay pending and do not reduce net.
2. **Pricing exceptions (exceptions.js + pricing.js)** — `createPricingException` always creates `PENDING` (ignores `approved: true` self-approve). Added `approvePricingException` with SoD. `filterApprovedExceptions(prisma, …)` is async and requires id + DB `APPROVED`; forged in-memory APPROVED is rejected. `calculateCommercialDocument` awaits DB-verified exceptions.
3. **Tax-inclusive grandTotal (pricingSnapshot.js + pricing.js)** — `buildCurrencyExplicitTotals` takes `inclusive`; when true, `grandTotal = netSubtotal` (net already includes tax). Exclusive path unchanged (`net + tax`).

Exports: `approvePricingException` via `commercial/index.js` and `lib/admin/crm/index.js`.

### Tests added (`test/systemAdmin.crm.commercialWave2.test.js`)

- forged APPROVED discount without DB APPROVED does not reduce netSubtotal
- forged APPROVED pricing exception without DB APPROVED does not alter unit price (+ create ignores `approved: true`)
- tax-inclusive grandTotal equals netSubtotal (does not double-count tax)

### Test command + output

```text
npx vitest run test/systemAdmin.crm.commercialWave2.test.js

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  01:01:43
   Duration  9.31s
```
