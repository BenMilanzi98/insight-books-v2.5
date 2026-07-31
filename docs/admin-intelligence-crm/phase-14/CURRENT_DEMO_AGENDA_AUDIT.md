# Current Demo Agenda Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmDemoAgenda / versioned agenda | NOT_FOUND | No Prisma model; no `lib/admin/crm/demos/agenda*` |
| Agenda pin on Demo | NOT_FOUND | — |
| Customer-safe agenda projection | NOT_FOUND | — |
| Activity/Task templates (adjacent) | FOUNDATION pattern | `lib/admin/crm/templates.js` — versioned; ACTIVE not directly editable — pattern for Wave 2 Demo content, not Demo Agenda |
| Meeting description as agenda | WRONG_DOMAIN / FORBIDDEN alias | Meeting fields must not become Demo Agenda truth |
| SoD agenda approve | NOT_FOUND | Automation SoD exists for Activity rules — not Agenda |

**Implication:** Wave 2 greenfield versioned Agenda; pin ACTIVE version to Demo; never edit ACTIVE in place.
