# Activity Security Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM authz resolution | EXTEND | `resolveCrmAccess` — notes/tasks/consent/export/opportunity keys |
| Scope filtering | PARTIAL / CARRY | `resolveCrmScope` returns `mode: 'all', stub: true` |
| Task/note create authz | FOUNDATION | Edit leads/opportunities gates |
| Eligibility API | FOUNDATION | `app/api/admin/crm/eligibility` |
| SoD merge (not automation yet) | CORRECT_AND_REUSABLE pattern | Requester ≠ approver for merges |
| CoA / GL / payment secrets on Activity | FORBIDDEN | Must not attach |
| Support ticket ACL as CRM ACL | WRONG_DOMAIN / FORBIDDEN | Separate permission planes |

**Implication:** Wave 1+ must FLS Activity APIs; harden scope for My Work / portfolio lists; automation SoD in Wave 4.

