# Current Support Route Audit

| Route | Class | Evidence |
|-------|-------|----------|
| `/insightbooks/support/**` | NOT_FOUND | ROUTE_INVENTORY PRD target |
| `/insightbooks/intelligence/customers/support` | NOT_INSTRUMENTED stub | CustomerStubView |
| `/insightbooks/customer-success/cases` | WRONG_DOMAIN | CS Cases |
| `/support` | READY disabled shell | Temporarily unavailable |
| `/help` | READY disabled shell | Temporarily unavailable |
| `/help/support` | NOT_FOUND | — |
| `/contact` | WRONG_SCOPE | Marketing demo form |

**Disposition:** Implement admin plane only; keep tenant shells disabled/redirect.
