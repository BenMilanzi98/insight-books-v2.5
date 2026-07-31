# Current Event Source Audit

| Source | Status | Class for Phase 4 |
|--------|--------|-------------------|
| AnalyticsEvent store | NOT_FOUND | CREATE |
| AdminAuditLog | Live | REUSE (admin actions / login) |
| Tenant auditLog | Partial (LOGIN) | REUSE carefully |
| MobileAppClientEvent | Mobile OTA only | KEEP separate |
| PlatformPayment / Invoice | Live SaaS ledger | PRODUCER source |
| AccountSubscription | Live commercial | PRODUCER source |
| Tenant lifecycle APIs | Live | PRODUCER source |
| PayChangu callback | Live | PRODUCER hook |
| CRM Lead/Demo/Ticket | NOT_FOUND | CATALOGUE scaffold only |
| Sale as engagement | UNSAFE for SaaS | NEVER as revenue fact |

See also `../EVENT_TRACKING_AUDIT.md`.
