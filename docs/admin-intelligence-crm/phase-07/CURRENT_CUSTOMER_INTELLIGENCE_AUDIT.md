# Current Customer Intelligence Audit

| Surface | Classification | Notes |
|---------|----------------|-------|
| `/insightbooks/tenant-management` | EXTEND / SEPARATE | Ops CRUD — not CI workbench |
| `/api/admin/tenants` | REUSE_WITH_RECONCILIATION | Identity + lifecycle ops |
| Revenue `.../customers` | REUSE_WITH_RECONCILIATION | Contribution analytics only |
| Executive customers/engagement | STANDARDISE | Envelopes; DAU UNAVAILABLE |
| `/intelligence/customers` | NOT_APPLICABLE | Does not exist yet |
| CustomerPortfolio | BLOCKED / NOT_APPLICABLE | Missing — Wave 3 |
| Opaque health widgets | REMOVE_AFTER_MIGRATION / NOT_APPLICABLE | Must not introduce in P7 |
