# Onboarding Tenant Readiness Matrix

| Dimension | Evaluate | Mutate from onboarding? | Current | Class | Wave |
|-----------|----------|-------------------------|---------|-------|------|
| Tenant exists + matches pin | Yes | No | Provision via conversion | CORRECT_AND_REUSABLE | 3 |
| Businesses vs accepted scope | Yes | No (call provision services only) | `businessBranch.js` | CORRECT_AND_REUSABLE | 3 |
| Branches vs accepted scope | Yes | No | Same | CORRECT_AND_REUSABLE | 3 |
| Users / invites / roles | Yes | Invite via hash-only services | `invitations.js` | CORRECT_AND_REUSABLE | 3 |
| Product configuration vs entitlements | Yes | No silent escalate | Subscription/entitlements | CORRECT_AND_REUSABLE | 3 |
| Accounting setup checklist | Yes | No journals/OB/stock | `accountingBoundary.js` pattern | REUSE_WITH_RECONCILIATION | 3 |
| Isolation / least privilege | Yes | No Super Admin grant | `isolation.js` | CORRECT_AND_REUSABLE | 3 |
| UNKNOWN | Never treat as READY | — | Absent evaluator | GO_LIVE_TRUTH_RISK | 3 |
