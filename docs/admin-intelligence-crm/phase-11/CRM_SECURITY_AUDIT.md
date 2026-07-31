# CRM Security Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Live `systemAdmin.crm.*` enforcement on CRM APIs | NOT_FOUND | No CRM APIs |
| Permission scaffold keys | PARTIAL | `leadsView`, `leadsManage`, `pipelineView`, `pipelineManage` — default deny |
| Pipeline permissions pre-Opportunity | PARTIAL | Scaffold anticipates pipeline; Phase 11 must not invent Opportunity UI behind them |
| Super Admin break-glass | READY (platform) | `authorizeAdminDecision` pattern |
| Owner / team / territory scope | NOT_FOUND | — |
| Merge / score-definition / qualification-definition SoD | NOT_FOUND | — |
| Public capture rate limiting / abuse | PARTIAL | Demo-request has field validation; no CRM-specific abuse plane audited as Lead gate |
| POS `sales.*` for CRM | WRONG_DOMAIN / FORBIDDEN | Must not authorize CRM via POS sales perms |
| Support / CS permissions for CRM mutate | FORBIDDEN | Read handoff links only |

**Implication:** Wave 1 live CRM authz from day one; expand scaffold beyond pipeline keys for accounts/contacts/consent/export/merge. Default deny preserved.
