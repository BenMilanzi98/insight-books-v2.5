# Current Onboarding Report Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding report catalogue | NOT_FOUND | Spec Overview/At-Risk/Overdue Customer Tasks/Go-Live Readiness/Completion |
| Onboarding metrics + reliability gate | NOT_FOUND | Spec `metrics.js`, `reliabilityGate.js` under onboarding |
| Conversion reports honesty pattern | CORRECT_AND_REUSABLE pattern | `conversions/reports.js`, `reliabilityGate.js` — gate fail ≠ fabricated zero |
| CS reports page | WRONG_DOMAIN / DISCONNECTED | `app/insightbooks/customer-success/reports/page.js` — CS ops reports, not onboarding Project KPIs |
| Invent zeroes when empty | FORBIDDEN | Preserve invent-zeroes invariant |

**Implication:** Wave 4 onboarding reports behind reliability gate; reuse conversion honesty patterns.
