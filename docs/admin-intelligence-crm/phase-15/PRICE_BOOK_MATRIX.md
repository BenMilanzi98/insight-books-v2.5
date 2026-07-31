# Price Book Matrix

| Concept | Exists? | Path | Class |
|---------|---------|------|-------|
| CRM Price Book PB- | No | — | NOT_FOUND → Wave 2 |
| Price Book version ACTIVE immutable | No | — | NOT_FOUND |
| Entries → plan/add-on/service versions | No | — | NOT_FOUND |
| PlatformPlanVersion | Yes | prisma / platformBilling | REUSE_WITH_RECONCILIATION |
| subscriptionConfig prices | Yes | `subscriptionConfig.js` | WRONG_SOURCE |
| Tenant Product.unitPrice | Yes | tenant Product | WRONG_DOMAIN |
| Customer-specific books | No | — | NOT_FOUND |
| Historical snapshot on issued doc | No | — | NOT_FOUND |
