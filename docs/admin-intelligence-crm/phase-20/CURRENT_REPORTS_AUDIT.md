# Current Conversion Reports Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Report centre | PARTIAL | EXTEND | `reports.js` `getConversionReport` / `getConversionOverview` |
| Reliability gate | READY | CORRECT_AND_REUSABLE | `reliabilityGate.js` — UNAVAILABLE / null, never invent 0 |
| Metrics helper | PARTIAL | EXTEND | `metrics.js` `getConversionMetric` |
| Closed-Won value ≠ Revenue | PARTIAL | EXTEND | Weighted pipeline honesty elsewhere; Wave 4 label discipline |
| Permission / scope deny | PARTIAL | EXTEND | Reports check access + scope; deepen fail-closed |
| Hub routes / search keys | FOUNDATION | EXTEND | `hubKeys.js` |

**Implication:** Honesty envelope exists; Wave 4 extends queues/metrics labels and scope fail-closed.
