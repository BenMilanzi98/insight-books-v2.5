# Data Integrity Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| DIR-01 | Stored actuals diverge from GL | Critical | Never store actuals on budget lines |
| DIR-02 | Float planned amounts drift | High | Integer minor units |
| DIR-03 | Parent + child double-count | Critical | POSTING_ACCOUNT_DETAIL mode + validation |
| DIR-04 | Cross-tenant accountId | Critical | Resolve account under tenant before save |
| DIR-05 | Silent overwrite of approved budget | Critical | Immutable versions; revise command |
| DIR-06 | Draft journals in actuals | Critical | Canonical posted-only filter |
| DIR-07 | Budget creates journals | Critical | No posting code paths in BF module |
| DIR-08 | Currency mix without FX policy | High | Single currency per budget; reject mix |
| DIR-09 | Legacy Budget name collision | High | Rename to Legacy* before greenfield |
| DIR-10 | Cache/report shows zero on failure | High | Fail closed; never coerce error to 0 |
