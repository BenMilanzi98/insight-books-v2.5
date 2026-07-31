# Current Exports Audit

| Check | Result | Evidence |
|-------|--------|----------|
| Customer intelligence export | READY foundation | `lib/admin/customers/export.js` + API |
| Health snapshot export | NOT_FOUND | — |
| CS case export | NOT_FOUND | — |

**Disposition:** Wave 1 health export (JSON/CSV of evaluation + drivers); Wave 4 CS export. Reuse Phase 7 export authz/portfolio patterns. Never include Tenant GL lines.
