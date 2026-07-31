# Test Coverage Audit

## Strong
test/accountingV2.ledger.test.js — reverse/preview/idempotency/permission

## Thin / stale
- test/invoiceReversalGl.integration.test.js — expects legacy Transaction path
- test/saleReversalLookup.test.js — static analysis
- test/payrollReversalLegacyRoot.test.js — fail-closed legacy

## Missing
- /api/transactions/reverse and /reversals route tests
- Eligibility/period/unique-race tests
- tax settle permission tests
- tax-summary export tests
- Tax hub route redirect smoke

## Wave 6 target
Expand V2 suite + new reversal façade + tax hub suites; FINAL_READINESS_DECISION.
