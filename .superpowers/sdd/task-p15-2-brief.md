### Task 2: Wave 2 — Price Books, pricing, tax/FX, discounts, approvals

**Depends on:** Task 1 complete (commercial spine: PRQ/PROP/QUO + versions).

**Do NOT git commit.**  
**Do NOT implement:** PDF render, issue/delivery, customer review, acceptance, e-sign, reports hubs (Wave 3–4).

## Goal

Ship CRM Price Books (+ immutable ACTIVE versions/entries), product configuration + line items, deterministic `calculateCommercialDocument` with immutable pricing snapshots and currency-explicit totals, in-platform tax + explicit FX snapshots (no silent convert), discount policies/requests with SoD, pricing exceptions, terms/clauses foundations, commercial approval engine with material-change invalidation. Vitest green.

## Files

Create under `lib/admin/crm/commercial/`:
- `priceBooks.js`, `productConfig.js`, `lineItems.js`, `pricing.js`, `pricingSnapshot.js`, `currencyFx.js`, `tax.js`, `discounts.js`, `exceptions.js`, `terms.js`, `clauses.js`, `approvals.js`
- Extend catalogue/model/index exports

Also:
- `scripts/sql/crm-commercial-phase15-wave2.sql`
- Prisma models: PriceBook/Version/Entry, TaxRule/RateVersion, DiscountPolicy/Request(+approval), PricingException, Term/Clause(+versions), ApprovalPolicy/Request/Step/Decision, PricingSnapshot (+ line item price/tax/discount as needed)
- Thin APIs/UI for price-books, discount-requests, tax-rules, commercial-approvals (stubs OK)
- Test: `test/systemAdmin.crm.commercialWave2.test.js` (mock prisma like Wave 1)

## Interfaces (exact)

```js
createPriceBook / approvePriceBookVersion / activatePriceBookVersion // ACTIVE immutable
calculateCommercialDocument({
  actorContext, commercialDocumentVersionId, priceBookVersionId, currency,
  lineItems, taxContext, discountRequests, pricingExceptions,
  calculationDate, idempotencyKey
}) // → { calculationId, snapshot, totals }; exact retry → same snapshot

submitCommercialDocumentForApproval({ actorContext, commercialDocumentVersionId, approvalPolicyVersionId, idempotencyKey })
decideApprovalStep({ ... }) // SoD: requester ≠ protected approver

// Totals (labels never swapped; currency-explicit):
// listSubtotal, netSubtotal, taxTotal, grandTotal,
// quotedMonthlyRecurring, quotedAnnualRecurring, firstYearTotal, totalContractValue
```

FX: missing/stale → `FX_CONTEXT_MISSING` / `STALE` — never silent convert; never false ZAR+USD sum.  
Tax: in-platform rules; overrides need approval; no Tenant GL tax; no MRA EIS fiscal.  
Discounts: threshold e.g. salesperson max 10% — 20% stays PENDING until approved; not applied to effective pricing until approved.  
Material change (e.g. qty) after full approval → invalidate affected approvals; new version path as Wave 1 allows.

## TDD (must cover)

- Price Book activate immutability (ACTIVE entry/version not silently edited)
- Pricing idempotent snapshot
- ZAR + USD not silently summed
- Missing FX → `FX_CONTEXT_MISSING`
- Tax override without approval fails
- 20% discount above 10% threshold stays pending
- Self-approve blocked
- Material qty change invalidates approval

## Hard rules

- Opp commercial estimates remain non-binding (do not treat as Price Book)
- No Tenant tax posting / MRA EIS submission
- No silent FX; gate fail ≠ fabricated zero
- No PDF/issue/acceptance
- hasCrm*Model + SQL fallback
- No commit

## Acceptance

- [ ] Vitest Wave 2 PASS with above cases
- [ ] ACTIVE Price Book versions immutable
- [ ] calculateCommercialDocument deterministic + idempotent
- [ ] Currency separation + FX gate
- [ ] Discount/exception SoD
- [ ] Approval invalidation on material change
- [ ] No tenant tax/MRA side effects; no commit

## Report

`.superpowers/sdd/task-p15-2-report.md` with RED/GREEN evidence. Return status + test summary + concerns + path only.
