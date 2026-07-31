# Current Onboarding Business/Branch Readiness Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Service | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/businessBranch.js` — `evaluateBusinessBranchReadiness`; compares tenant Business/Branch counts vs `confirmedScope` / `ownerAssignmentsJson.confirmedScope` |
| Pin honesty / UNKNOWN | PARTIAL | Missing confirmed scope → `UNKNOWN` (`confirmed_scope_unavailable`); Business/Branch model unavailable → `UNKNOWN` (`business_branch_model_unavailable`); shortfall → `NOT_READY`; never fabricates READY without counts |
| Fail-closed writes-by-id | PARTIAL | Evaluate-only today; writes-by-id must deepen with `lib/admin/customerSuccess/onboarding/listScope.js` (`resolveOnboardingListScope` / `tenantWhereFromScope`) + `projectAccess.js` in Wave 2 |
| Aggregate wiring | PARTIAL | Dimension included in `lib/admin/customerSuccess/onboarding/readiness/evaluate.js` `CORE_DIMENSIONS` as `businessBranch` |
| Fabricate Branch IDs | FORBIDDEN | Never invent Business/Branch identity from onboarding readiness |

**Gaps:** G21-11 → Wave 2 (fail-closed writes-by-id + pin honesty harden).
