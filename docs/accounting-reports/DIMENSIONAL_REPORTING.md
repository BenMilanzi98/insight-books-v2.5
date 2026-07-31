# Dimensional Reporting

## Current support

- **Branch** — first-class: `branchId` flows from the request through
  `getBusinessLedgerSummary` / `getCanonicalAccountTotals` into the canonical
  where-clauses (transaction and journal headers), so every report can run
  branch-scoped end to end.
- **Journal-line dimensions** — canonical lines normalize a `dimensions`
  object (branch plus any per-line dimension JSON from V2 journals) with a
  `dimensionStatus` of ASSIGNED / PARTIAL / UNASSIGNED. `getAccountLedger`
  accepts `dimensionKey`/`dimensionValue` filters, including the sentinel
  `'UNASSIGNED'` to isolate lines with no value for a dimension.
- **Unassigned handling** — historical lines missing dimensions are surfaced
  as UNASSIGNED and the amount is disclosed; they are **never silently
  allocated**. Remaining dimension gaps link to the Phase 6 exception
  register through the unresolved-exceptions disclosure on every envelope.

## Deferred (recorded, not hidden)

Department / project / cost-centre parameters are accepted on the request
contract and preserved for audit, but statement-level slicing by those
dimensions awaits dimension capture on all posting paths (most legacy lines
carry no such dimensions, so a sliced statement would be materially
UNASSIGNED). Until then, dimension analysis is available at account
drill-down level via the dimension filters above. Customer/supplier/employee/
asset/loan entity dimensions follow the same plan.

This staging is deliberate: presenting a project P&L over data where most
lines are unassigned would violate the disclosure rules, so the engine exposes
the honest view (drill-down with UNASSIGNED buckets) first.
