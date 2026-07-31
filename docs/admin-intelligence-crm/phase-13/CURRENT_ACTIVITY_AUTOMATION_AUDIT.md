# Current Activity Automation Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM automation rule engine | NOT_FOUND | No `lib/admin/crm/automation/*` |
| SoD automation approval | NOT_FOUND | Merge SoD exists for Lead/Opportunity — not automation rules |
| Idempotent automation execution | NOT_FOUND | — |
| Approved trigger set (Lead assigned → Task, etc.) | NOT_FOUND | Assignment exists (`assignment.js`) but no auto Task create from assignment |
| Full sales sequences | NOT_FOUND / FORBIDDEN invent | Explicitly out of scope |
| CS playbook execution | WRONG_DOMAIN | Deterministic CsTask expansion — not Sales automation |

**Implication:** Wave 4 automation foundations only — small trigger set, SoD, idempotency; no arbitrary code / sequences.

