# Current Activity Template Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Activity / task templates (CRM) | NOT_FOUND | No template models under CRM Prisma |
| Versioned template governance | NOT_FOUND | — |
| Email template governance (Sales) | NOT_FOUND | Platform `emailService` templates are transactional WRONG_DOMAIN for Sales Activity templates |
| CS playbook step templates | WRONG_DOMAIN | Expand to CsTask — forbidden as Sales templates |
| Active-not-directly-editable rule | NOT_FOUND (design locked) | Wave 4 |

**Implication:** Wave 4 introduces versioned Activity/task (+ email template foundations in Wave 2); no executable expressions.

