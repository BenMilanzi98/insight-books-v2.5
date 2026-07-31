# Adoption Expansion Handoff Matrix

| Concern | Current | Class | Wave |
|---------|---------|-------|------|
| CS `CsExpansionHandoff` record-only | READY — `handoffs.js` | REUSE_WITH_RECONCILIATION | 3 ref |
| Adoption expansion handoff entity | Absent | NOT_FOUND | 3 |
| Status DRAFT→HANDED_OFF→ACKNOWLEDGED\|REJECTED\|EXPIRED | Absent | NOT_FOUND | 3 |
| Target queue RENEWALS\|SALES\|CS_LEADERSHIP | Design lock | EXTEND | 3 |
| Mutate Subscription / Entitlement / Invoice / Tenant GL | Forbidden | FORBIDDEN | All |
| Exact retry same key → same row | Absent | NOT_FOUND | 3 |
| Renewals execute-after-ACK | Out of scope | NOT_AVAILABLE | Phase 20 |
