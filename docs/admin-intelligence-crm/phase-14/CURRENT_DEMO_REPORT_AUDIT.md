# Current Demo Report Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo reporting centre | NOT_FOUND | No demo reports module/UI |
| Demo report schedules | NOT_FOUND | — |
| Honesty gate (EMPTY/UNAVAILABLE) | FOUNDATION pattern | Activity `activities/reports.js` + Pipeline reports — never false zeroes |
| Activity report schedules | CORRECT_AND_REUSABLE pattern | `reportSchedules.js` audited create/list/run |
| Pipeline report centre | CORRECT_AND_REUSABLE pattern | Opportunity/Pipeline reporting — currency-separated |
| Fabricated Demo volume KPIs | FORBIDDEN | No Demo entity → any Demo KPI today would be invented |
| Weighted Pipeline totals | NOT_AVAILABLE / Phase 16 | `WEIGHTED_PIPELINE_UI_ENABLED === false` |

**Implication:** Wave 4 Demo reporting centre + schedules; gate fail → EMPTY/UNAVAILABLE; never invent Demo volume from Lead DEMO_REQUEST counts alone without honest labelling.
