# Current Demo Export Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo export API | NOT_FOUND | No demos export |
| CRM Lead/entity export | FOUNDATION pattern | `lib/admin/crm/export.js` + `/api/admin/crm/export` — permission recheck pattern |
| Restricted script in export | NOT_FOUND (must block) | Wave 2 rule: restricted Script never on default exports |
| Recording consent data in export | NOT_FOUND | Wave 4 — minimize; FLS |
| Customer-safe agenda export | NOT_FOUND | — |
| ICS as Demo export | PARTIAL / WRONG_SHAPE | Calendar ICS exports Meeting events — not Demo package export |

**Implication:** Wave 4+ Demo exports must recheck FLS, strip restricted scripts, never include Production credentials.
