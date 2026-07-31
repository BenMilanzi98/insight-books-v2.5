# Conversion Performance Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion list/report pagination | NOT_FOUND | Design requires server pagination |
| Durable step runner scalability | NOT_FOUND | — |
| Commercial honesty gate pattern | CORRECT_AND_REUSABLE | Fail → UNAVAILABLE |
| Tenant create synchronous CoA init | PERFORMANCE_RISK / FOUNDATION | Bounded bootstrap on create path |
| N+1 acceptance scan in conversionReadiness | PERFORMANCE_RISK / FOUNDATION | Soft checklist; orchestrator should pin handoff ids |

**Implication:** Wave 1 pin acceptance/handoff ids; Wave 4 paginate hubs; gate KPI scans.
