# Pipeline Security Matrix (planned permissions)

| Action | Permission (planned / scaffold) | Scope | Class today |
|--------|----------------------------------|-------|-------------|
| View Pipeline board / list | `systemAdmin.crm.pipeline.view` | Owner / team / territory | PARTIAL scaffold |
| Manage Pipeline catalogue / stages | `systemAdmin.crm.pipeline.manage` | Admin + SoD on publish | PARTIAL scaffold |
| View Opportunities | `systemAdmin.crm.opportunity.view` (planned) | Scoped | NOT_FOUND |
| Manage Opportunities (create/update) | `systemAdmin.crm.opportunity.manage` | Scoped; READY create | NOT_FOUND |
| Transition stage | transition (manage or dedicated) | Server-authorised | NOT_FOUND |
| Close Won / Lost | close (SoD/evidence) | Evidence required | NOT_FOUND |
| Merge duplicates | merge | SoD dual control | NOT_FOUND |
| Import | import | Audited | NOT_FOUND |
| Export | export | Recheck download + audit | PARTIAL (CRM export pattern) |
| Run recon | runReconciliation | Technical | PARTIAL (CRM pattern) |
| Weighted Pipeline UI | Phase 16 flag | — | NOT_AVAILABLE |
| Public unauthenticated Opportunity create | — | — | FORBIDDEN |

**Actors:** Sales (scoped), Sales Manager (team), Auditor (read-only), Super Admin break-glass.  
**Forbidden:** Authorize via Tenant POS `sales.*`; mutate billing/MRA/GL from Pipeline; alias analytics-pipeline `health.view` as Sales Pipeline authz.
