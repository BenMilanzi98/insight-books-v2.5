# Current Stage Transition Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Server transition service | NOT_FOUND | No Opportunity transition module |
| Immutable stage history | NOT_FOUND | — |
| Board drag persistence | NOT_FOUND | No Kanban |
| Client-only stage mutate | FORBIDDEN (planned guard) | Design: drag never persists without server OK |
| Lead status history reuse as stage history | WRONG_DOMAIN | `CrmLeadStatusHistory` is Lead-only |
| AdminAuditLog as stage history | WRONG_DOMAIN | Insufficient domain semantics |

**Implication:** Wave 1 transition service authorises all moves; history immutable; UI board posts to server only.
