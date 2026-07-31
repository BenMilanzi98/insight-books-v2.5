# Current Lead Lifecycle Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Canonical Lead statuses | NOT_FOUND | No state machine module |
| Invalid transition rejection | NOT_FOUND | — |
| Status history table | NOT_FOUND | — |
| New → Working → Qualified → … flow | NOT_FOUND | PRD lifecycle in CRM_GAP_REGISTER is aspirational only |
| Disqualify / recycle / convert markers | NOT_FOUND | — |
| Lead → Tenant conversion linkage | PARTIAL (human) | Admins can create tenants; no Lead ID on Tenant |
| Lead → Opportunity | NOT_AVAILABLE | Opportunities out of create scope this phase |
| AdminAuditLog as lifecycle | WRONG_DOMAIN | Generic admin actions |
| CsCase status as Lead lifecycle | FORBIDDEN | Different domain SM |
| SupportTicket status as Lead lifecycle | FORBIDDEN | Different domain SM |

**Implication:** Wave 1 ships canonical Lead status SM + history. Conversion remains human/process until explicit later bridge; Opportunity create stays out of Phase 11.
