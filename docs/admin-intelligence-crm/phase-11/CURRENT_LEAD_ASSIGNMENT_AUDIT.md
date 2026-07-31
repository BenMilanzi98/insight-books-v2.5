# Current Lead Assignment Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Lead owner field | NOT_FOUND | — |
| Assignment history | NOT_FOUND | — |
| Round-robin / rule routing | NOT_FOUND | — |
| Silent reassignment loops | N/A | No assignment plane |
| Support queue assignment as Lead assignment | WRONG_DOMAIN | `lib/admin/support/assignment.js` — tickets only |
| CS case ownership as Lead ownership | WRONG_DOMAIN | CsCase assignees |
| Admin role alone as ownership | PARTIAL | Admins exist; no Lead-owner model |

**Implication:** Wave 3 ownership + assignment history on CrmLead. Reuse Admin identity as assignee; do not reuse Support queues as CRM assignment.
