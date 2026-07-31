# Owner Capital Duplication — Root Cause

## Symptom

Posted MK1,000,000 capital displayed as MK2,000,000 on CoA / equity views.

## Root cause classes

1. **Presentation double-fold**: 3101–3199 rolled via parentAccountId and again via 3100 catch-all bucket.
2. **Stored + derived**: Account.balance / EquityAccount.currentBalance added to journal-derived totals.
3. **Duplicate journals**: two capital postings for one contribution (idempotency failure / migration).

## Fix in code

- Exclude DB children of 3100 from capital dropdown fold
- `apply3100CapitalBucketAncestorPropagation` after rollup
- Regression: `coaRollupInventory` + REG-CAP-005

## Residual

Live tenant forensic via `runCapitalEquityAudit` **not executed in this pass**.

## Result

**CODE FIXED FOR KNOWN PRESENTATION BUG · DATA CERTIFICATION PENDING**
