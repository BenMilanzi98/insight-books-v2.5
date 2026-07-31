# Training Performance Audit

**Audited:** 2026-07-31

| Area | Current | Class | Wave |
|------|---------|-------|------|
| Training list/detail queries | No domain | NOT_FOUND | 1–4 |
| Overview cards N+1 risk | Absent | PERFORMANCE_RISK when built | 4 |
| Session/Meeting join fan-out | Meeting service exists | EXTEND / PERFORMANCE_RISK | 2–4 |
| Assessment attempt concurrency | Absent | PERFORMANCE_RISK | 3 |
| Metrics cache + watermark | Absent | PERFORMANCE_RISK | 4 |
| Search TRQ/TRN/cert | Absent | PERFORMANCE_RISK | 4 |
| Foundations `findMany` take 100 | Present in `foundations.js` | CORRECT_AND_REUSABLE bound for foundations only | — |
| Reliability gate short-circuit | Pattern in onboarding/conversions | CORRECT_AND_REUSABLE | 4 |

**Disposition:** Bound list queries; cache with permission/curriculum/assessment version keys; gate fail short-circuits to UNAVAILABLE without scanning fabricated zeros.
