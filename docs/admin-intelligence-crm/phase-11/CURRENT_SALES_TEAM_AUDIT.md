# Current Sales Team Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM sales team model | NOT_FOUND | — |
| Team membership / capacity | NOT_FOUND | — |
| Sales RBAC beyond scaffold | PARTIAL | `INTEL_CRM_PERMISSION_SCAFFOLD.crm.*` keys; no live crm category grants in SYSTEM_ADMIN UI |
| SupportTeam as sales team | WRONG_DOMAIN | Phase 10 support teams |
| Portfolio as sales team | WRONG_DOMAIN | Customer portfolio scope ≠ sales org |
| Tenant POS sales users | WRONG_DOMAIN | `sales.view` / `sales.create` = POS |

**Implication:** Wave 3 CRM teams distinct from SupportTeam and POS sales permissions. Extend Admin permission plane with live `systemAdmin.crm.*` actions.
