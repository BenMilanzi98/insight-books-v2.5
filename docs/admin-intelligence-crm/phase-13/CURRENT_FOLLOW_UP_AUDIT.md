# Current Follow-Up Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmFollowUp model | NOT_FOUND | No Prisma model / lib module |
| Follow-Up CRUD service | NOT_FOUND | No `lib/admin/crm/followUps.js` |
| Next-Action evaluator | NOT_FOUND | No `evaluateNextAction` / `listNoNextActionOpportunities` in CRM |
| Opportunity next-action field | NOT_FOUND | Opportunity model has risks/tasks/timeline — no dedicated next-action entity |
| Consent-blocked Follow-Up policy | NOT_FOUND | Eligibility exists but no Follow-Up consumer |
| UI/API hubs | NOT_FOUND | No `/follow-ups` routes |
| Marketing "follow up" copy | WRONG_DOMAIN | Landing/start-trial marketing strings — not CRM Follow-Up |
| CS playbook follow-up steps | WRONG_DOMAIN | `lib/admin/customerSuccess/playbooks.js` expands to CsTask |

**Implication:** Wave 1 greenfield Follow-Up + Next-Action; do not promote CsTask playbook steps as Sales Follow-Ups.

