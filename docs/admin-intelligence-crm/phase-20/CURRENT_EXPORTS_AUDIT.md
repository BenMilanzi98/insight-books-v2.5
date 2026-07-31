# Current Conversion Exports Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Dedicated conversion `exports.js` | GAP | NOT_FOUND | No module under `lib/admin/crm/conversions/` |
| Revalidated permission on export | GAP | EXTEND | Wave 4 |
| PII projection / no secrets | GAP | EXTEND | Wave 4 — strip passwords, payment tokens, MRA credentials |
| Formula injection neutralised | GAP | EXTEND | CSV/XLSX Wave 4 |
| en + ny export strings | PARTIAL | FOUNDATION | Hub i18n keys exist; export catalogue incomplete |
| Commercial export pattern reuse | READY | REUSE_WITH_RECONCILIATION | Tree phase-15 commercial exports as pattern only |

**Implication:** Exports are a Wave 4 gap (Critical/High for privacy). Do not claim export readiness at Wave 0.
