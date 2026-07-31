# Customer Match Matrix

| Match state | Action allowed | Present today | Wave | Class |
|-------------|----------------|---------------|------|-------|
| EXACT_EXISTING_CUSTOMER | Link only | NOT_FOUND | 2 | NOT_FOUND |
| HIGH_CONFIDENCE_MATCH | Link with SoD / confirm | NOT_FOUND | 2 | NOT_FOUND |
| POSSIBLE_MATCH | Block create; review | NOT_FOUND | 2 | NOT_FOUND / CUSTOMER_DUPLICATION_RISK if ignored |
| NO_MATCH | Create allowed | NOT_FOUND | 2 | NOT_FOUND |
| CONFLICT | Block; escalate | NOT_FOUND | 2 | NOT_FOUND |
| MANUAL_REVIEW_REQUIRED | Human decision | NOT_FOUND | 2 | NOT_FOUND |
| Similar name alone | Never auto-merge | Absent (good) | — | FORBIDDEN |
| CRM Lead duplicate candidate | Different plane | `crm/duplicates.js` | — | FOUNDATION pattern / REUSE_WITH_RECONCILIATION |

**Evidence keys (design):** existing Customer/Tenant id, CRM Account link, registration/tax IDs, verified domain/email/phone, legal/trading name.
