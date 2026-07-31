# Current Contact Role Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity contact roles (champion / economic buyer / etc.) | NOT_FOUND | — |
| CrmContact on Lead/Account | READY | Phase 11 Contact plane |
| Handoff contactId | READY | Payload field; role not typed |
| Contact = Platform User | FORBIDDEN | Verified link only; no auto access |
| Support requester as Opportunity role | WRONG_DOMAIN | — |

**Implication:** Wave 2 Opportunity contact roles layered on CrmContact links; preserve Account/Contact identity from handoff.
