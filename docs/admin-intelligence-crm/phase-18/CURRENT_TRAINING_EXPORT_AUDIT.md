# Current Training Export Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training CSV/XLSX export | NOT_FOUND | No Training export service |
| CS export route | EXTEND / WRONG_SCOPE today | `app/api/admin/customer-success/export/route.js` + `lib/admin/customerSuccess/export.js` — cases/tasks/plans/handoffs; no Training Program export |
| Strip answers / tokens / credentials | FORBIDDEN if leaked | Hard rule for Wave 4 exports/search |
| Permission recheck on export | NOT_FOUND | Must recheck Training perms + portfolio scope |

**Implication:** Wave 4 Training exports with PII projection; answers/tokens/restricted materials excluded.
