# Bank Reconciliation Rollback Strategy

## Feature flags

Disable `bankReconciliationV2Enabled` to hide APIs (403) and stop new sessions.  
Disable `bankReconciliationPeriodCloseFeedEnabled` to revert period-close task to manual evidence (`MANUAL_FALLBACK`).

## Data

All Phase 10 tables are additive. Rollback does **not** drop tables in production without an explicit DBA change request.

Safe operational rollback:

1. Turn flags OFF  
2. Remove `/bank-reconciliation` from active nav (optional)  
3. Point checklist template back to `STANDARD_MONTHLY_CLOSE@1.0.0` if needed  
4. Retain snapshots for audit

## What is never rolled back via flag

Posted adjustment journals created during recon remain in the GL (reverse via normal journal reversal workflows).
