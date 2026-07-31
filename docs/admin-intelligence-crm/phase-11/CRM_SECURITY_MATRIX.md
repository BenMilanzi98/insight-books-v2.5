# CRM Security Matrix (planned permissions)

| Action | Permission (planned / scaffold) | Scope | Class today |
|--------|----------------------------------|-------|-------------|
| View leads / accounts / contacts | `systemAdmin.crm.leads.view` (+ account/contact keys Wave 1) | Owner / team / territory | PARTIAL scaffold |
| Manage leads (create/update/status) | `systemAdmin.crm.leads.manage` | Scoped | PARTIAL scaffold |
| Pipeline view/manage | `pipeline.view` / `pipeline.manage` | Deferred UI — do not invent Opportunity | PARTIAL scaffold |
| Assign / reassign | assign (Wave 3 key) | Team lead+ | NOT_FOUND |
| Manage qualification / score definitions | manageDefinitions (Wave 3) | SoD vs approve | NOT_FOUND |
| Approve definition publish | approveDefinitions | SoD | NOT_FOUND |
| Merge duplicates | merge (Wave 4) | SoD dual control | NOT_FOUND |
| Manage consent / DNC | consent.manage | Explicit | NOT_FOUND |
| Export | export | Recheck download + audit | NOT_FOUND |
| Run recon | runReconciliation | Technical | NOT_FOUND |
| Public capture | Unauthenticated form + abuse controls | Source-bound | PARTIAL (email only) |

**Actors:** Sales (scoped), Sales Manager (team), Auditor (read-only), Super Admin break-glass.  
**Forbidden:** Authorize CRM via Tenant POS `sales.*`; mutate billing/MRA/GL from CRM; leak Support RESTRICTED into CRM UI.
