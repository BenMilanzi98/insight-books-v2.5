# Business Sign-Off Guide

Every repaired business receives a sign-off pack under
`artifacts/accounting-repair/business-signoff/<businessId>/` (git-ignored —
production financial data never enters the repository; only this guide and
templates are committed).

## Pack contents

1. Business identity and periods covered.
2. Anomalies repaired (by type, with anomaly ids and repair journals) and
   anomalies remaining (exceptions with reasons).
3. Journals created: reversals, reclassifications, adjustments, missing
   journals (HREP- numbers, amounts, approvals).
4. BEFORE and AFTER snapshots (balances by account, totals, checksums) and the
   delta versus approved expected impact.
5. Trial Balance status (debits = credits, difference if any).
6. Reconciliation results: AR, AP, inventory, payroll, fixed assets, loans,
   taxes, equity — each "reconciled" or "exception documented".
7. Capital discrepancy result and unsupported-liability result for the
   business.
8. Exception register extract with disclosure requirements.
9. Reviewers: finance reviewer (required), auditor reviewer (required for
   prior-year/tax-impacting repairs), sign-off date.

## Generation

Data sources: batch + snapshot tables (`verify` output), anomaly registry
filtered by business, and `scripts/accounting-repair.mjs list/reconcile
--business <id> --output` exports. Assemble per template; obtain signatures;
store the signed pack in the artifacts folder and record the sign-off date on
the batch metadata.

A business with material open exceptions may sign off only with the exceptions
explicitly listed and accepted — Phase 7 will qualify its reports accordingly.
