# Phase 8 Gap Register

| ID | Gap | Severity | Disposition |
|----|-----|----------|-------------|
| H01 | No HealthDefinition / Snapshot models or engine | High | Wave 1 |
| H02 | No customer-health routes/APIs/permissions | High | Waves 1–2 |
| H03 | Adoption / FEATURE_USED unavailable | High | NOT_APPLICABLE dim; carry blocker |
| H04 | SupportTicket unavailable | Medium | NOT_APPLICABLE service dim; carry blocker |
| H05 | Temptation to score missing as 0 | High | EXCLUDE_AND_RENORMALISE + tests |
| H06 | Temptation to label score as churn % | High | Forbidden copy + catalogue |
| C01 | No CS Ops surface / cases / tasks | High | Waves 2–3 |
| C02 | No playbooks / success plans | Medium | Wave 4 |
| C03 | No renewal outcome ledger | Medium | Wave 3 + sub evidence gate |
| C04 | Onboarding/training/surveys uninstrumented | Medium | Source-gated Wave 4; carry blocker |
| C05 | Signal ACK mistaken for case workflow | Medium | Separate CsCase; document in matrix |
| C06 | ROUTE_INVENTORY stale on intelligence routes | Low | Refresh when Wave 2 ships |
| C07 | Prisma generate EPERM on Windows when Next locks engine | Ops | SQL fallbacks / stop server (Phase 7 note) |
| X01 | Lead/CRM out of scope | Info | Deferred by user |

**Open blockers expected at Phase 8 exit:** H03, H04, C04 (unless instrumented mid-phase).
