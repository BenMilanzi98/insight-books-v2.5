# Health Source Matrix

| Dimension | Source module / tables | Class | v1 role |
|-----------|------------------------|-------|---------|
| commercial | `customers/commercial.js` → AccountSubscription, PlatformInvoice, Payment | READY_WITH_LIMITATIONS | SCORED |
| engagement | `customers/engagement.js` → User.lastLogin | READY_WITH_LIMITATIONS | SCORED (proxy) |
| mraEis | `customers/mraEis.js` → MraEisTenantEntitlement | READY_WITH_LIMITATIONS | SCORED or N/A |
| relationship | CustomerOwnership + CustomerSignal open set | READY_WITH_LIMITATIONS | SCORED |
| adoption | FEATURE_USED | UNAVAILABLE | NOT_APPLICABLE |
| service/support | SupportTicket | NOT_INSTRUMENTED | NOT_APPLICABLE |
| onboarding | CS onboarding models | NOT_INSTRUMENTED | NOT_APPLICABLE |
| training | CS training models | NOT_INSTRUMENTED | NOT_APPLICABLE |
| nps/survey | Survey responses | NOT_INSTRUMENTED | NOT_APPLICABLE |
| Tenant Sale / Tenant GL | Tenant operational books | FORBIDDEN | Never use |

**UI rule:** SCORED dims contribute; N/A excluded + renormalise; FAILED/UNAVAILABLE reduce confidence and may null the score.
