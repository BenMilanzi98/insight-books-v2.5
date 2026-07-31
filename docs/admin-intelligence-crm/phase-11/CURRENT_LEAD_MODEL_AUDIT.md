# Current Lead Model Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| `CrmLead` Prisma model | NOT_FOUND | No Lead* / CrmLead in schema |
| Lead numbering (`LEAD-YYYY-######`) | NOT_FOUND | — |
| Lead status state machine | NOT_FOUND | — |
| Lead status history | NOT_FOUND | — |
| Lead ↔ Account / Contact links | NOT_FOUND | — |
| Opportunity readiness fields | NOT_FOUND | Opportunities out of Phase 11 create scope |
| AdminAuditLog as Lead proxy | WRONG_DOMAIN | Compliance audit ≠ sales Lead |
| Tenant Client as Lead proxy | WRONG_DOMAIN | Post-tenant accounting party |
| CsCase as Lead proxy | FORBIDDEN | Retention cases |
| SupportTicket as Lead proxy | FORBIDDEN | Service tickets |
| Permission keys `systemAdmin.crm.leads.*` | PARTIAL | Scaffold only; no Lead APIs to authorize |

**Implication:** Wave 1 greenfield Lead model with concurrency-safe numbering and canonical statuses. No reuse of Tenant/CS/Support entities as Leads.
