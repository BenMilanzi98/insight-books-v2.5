# Phase 9 Gap Register

| ID | Gap | Severity | Disposition |
|----|-----|----------|-------------|
| P9-G01 | No product-analytics routes/libs | High | Waves 1–3 |
| P9-G02 | FEATURE_USED / meaningful producers absent | Critical | Wave 1 commerce; expand later |
| P9-G03 | No governed Feature catalogue | High | Wave 1 |
| P9-G04 | No first-value / adoption engines | High | Wave 2 |
| P9-G05 | Product DAU conflation with login | High | Forbid; gate |
| P9-G06 | Android product usage absent | Medium | NOT_INSTRUMENTED; version telemetry only |
| P9-G07 | MRA analytics emit absent | High | Wave 1 accepted producer |
| P9-G08 | Funnels/cohorts/journeys absent | Medium | Wave 4 instrumented only |
| P9-G09 | Historical plan entitlement resolution incomplete | Medium | Wave 1 entitlement resolver |
| P9-G10 | emitUserLogin unwired | Low | Optional; not product value |
| P9-G11 | Temptation to proxy domain counts as live metrics | Critical | Strict-events lock |
| P9-G12 | Support / onboarding still uninstrumented | Info | Out of P9 product core; Phase 10+ |

**Expected exit blockers:** P9-G02 (partial after commerce), P9-G06, broad module coverage.
