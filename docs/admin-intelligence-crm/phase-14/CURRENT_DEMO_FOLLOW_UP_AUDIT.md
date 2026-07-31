# Current Demo Follow-Up Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo-linked Follow-Up create | NOT_FOUND | No Demo → Follow-Up bridge |
| CrmFollowUp / Next-Action | READY / EXTEND | `lib/admin/crm/followUps.js`, `nextAction.js`; APIs `/api/admin/crm/follow-ups`, `/next-action` |
| Consent-blocked never auto-run | CORRECT_AND_REUSABLE | P13 rule — preserve |
| Due ≠ complete | CORRECT_AND_REUSABLE | Follow-Up semantics |
| Reminder as Follow-Up | FORBIDDEN alias | Reminder delivery ≠ Activity/Follow-Up complete |
| CS playbook follow-up | WRONG_DOMAIN | CsTask / CS plane |

**Implication:** Wave 4 create Follow-Ups from Demo outcome via Phase 13 services; subject link includes Demo when model exists.
