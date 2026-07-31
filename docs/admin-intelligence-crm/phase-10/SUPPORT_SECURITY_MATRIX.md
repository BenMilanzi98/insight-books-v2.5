# Support Security Matrix (planned permissions)

| Action | Permission | Scope |
|--------|------------|-------|
| View overview / my work / tickets | `support.view*` | Queue / assignment |
| Create / reply publicly | `createTickets` / `replyPublicly` | Queue |
| Internal notes | `addInternalNotes` | Queue |
| Restricted notes | `addRestrictedNotes` | Explicit |
| Assign / merge | `assignTickets` / `mergeTickets` | Manager+ |
| Manage SLA | `manageSla` | SoD with approver |
| Export / schedule | `export` / `scheduleReports` | Recheck download |
| Run recon | `runReconciliation` | Technical |

CS: portfolio-scoped **summaries** only. Finance: billing context only. Auditor: read-only.
