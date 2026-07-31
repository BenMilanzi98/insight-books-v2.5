# Current Commercial Report Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial document reports | NOT_FOUND | — |
| Commercial reliability gate on metrics | NOT_FOUND | — |
| Opp pipeline reports | CORRECT_AND_REUSABLE | `opportunities/reports.js` — pipeline; weighted NOT_AVAILABLE |
| Demo reports honesty pattern | CORRECT_AND_REUSABLE (pattern) | Phase 14 `demos/reports.js` — EMPTY/UNAVAILABLE |
| Activity reports honesty pattern | CORRECT_AND_REUSABLE (pattern) | Phase 13 |
| Platform customer commercial KPIs | WRONG_DOMAIN | `lib/admin/customers/commercial.js` |
| Pipeline report take:5000 | PERFORMANCE_RISK | Scale note for commercial reports too |

**Implication:** Wave 4 commercial reports with reliability gate; never false zero; currency-separated.
