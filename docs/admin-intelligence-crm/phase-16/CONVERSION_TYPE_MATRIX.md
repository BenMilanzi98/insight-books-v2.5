# Conversion Type Matrix

| Type | Required steps (design) | Present today | Wave | Class |
|------|-------------------------|---------------|------|-------|
| NEW_CUSTOMER_NEW_TENANT | Full create path | No | 1–4 | NOT_FOUND |
| EXISTING_CUSTOMER_NEW_SUBSCRIPTION | Link Customer + new Sub | No | 2–3 | NOT_FOUND |
| UPGRADE / ADD_ON / QUANTITY | Amend subscription/entitlements | Partial via `upgradeTenantSubscription` | 3 | FOUNDATION / EXTEND |
| EXISTING_CUSTOMER_NEW_BUSINESS / BRANCH | Link + Business/Branch | No | 2 | NOT_FOUND |
| PARTNER / RESELLER | Typed source + steps | No | 1+ | NOT_FOUND |
| MANUAL_APPROVED | Human-gated without commercial handoff | No | 1 | NOT_FOUND |
| LEGACY | Controlled import | No | later | NOT_AVAILABLE |

**Rule:** Each type defines create-vs-link actions; dry run must show them before execute.
