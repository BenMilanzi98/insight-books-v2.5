# Adjustments Affecting Closed Periods

The system never chooses the accounting treatment; an authorized user selects
one of the approved paths:

| Treatment | Mechanism |
| --- | --- |
| A. Reopen and correct the original period | Reopening workflow (approval + restricted scope) → post adjustment into REOPENED period (requires `accountingPeriods.postAdjustments`) → re-close |
| B. Current-period adjustment referencing the historical period | Phase 4 adjustment journal posted into the current OPEN period with a reference to the original period in its metadata |
| C. Prior-period adjustment per policy | Phase 6 repair framework (wrong-period correction, historical exception register) |
| D. Year-end retained-earnings treatment | Deferred to Phase 12 (year-end close) |

Required in all cases: adjustment category, reason, original period
reference, current posting period, approval, and the resulting audit trail.
Report impact is handled by snapshot supersession (new snapshots on
re-close; originals preserved).

## Adjustment periods

`isAdjustmentPeriod` exists on the model and the resolver excludes adjustment
periods from ordinary date resolution, but **no 13th period is created
automatically** — none of the current businesses require one. If a business
approves an adjustment-period policy, the flag, elevated permissions and
distinct reporting treatment are already modeled.
