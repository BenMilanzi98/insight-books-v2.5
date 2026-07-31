# Opportunity Performance Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity list/board query load | NOT_FOUND | No store / UI |
| Board column bounded queries | NOT_FOUND | Design: bounded columns |
| Weighted Pipeline calc cost | NOT_AVAILABLE (UI) | Service may land Wave 4; UI dark until Phase 16 |
| Timeline pagination pattern | CORRECT_AND_REUSABLE | Phase 11 paginated timeline |
| Unbounded Opportunity export | FORBIDDEN invent | Must page / cap like CRM export |
| Analytics-pipeline backfill as Pipeline perf | WRONG_DOMAIN | — |

**Implication:** Wave 3 board uses bounded stage queries; Wave 4 reports/export capped. Do not run weighted UI scans until Phase 16.
