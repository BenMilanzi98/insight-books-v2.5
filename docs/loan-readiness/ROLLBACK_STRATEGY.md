# Rollback Strategy

1. Set `loanReadinessV2Enabled` (and related LOAN_READINESS_FLAGS) to `enabled: false`.  
2. Hide `/loan-readiness` via permissions.  
3. Preserve `LrdV2*` assessments, snapshots, loan requests, AI review history.  

Must not: delete approved assessments, post proposed loans, alter GL, remove disclaimers.
