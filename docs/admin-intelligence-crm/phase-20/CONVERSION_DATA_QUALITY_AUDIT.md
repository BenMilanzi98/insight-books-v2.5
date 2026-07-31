# Conversion Data Quality Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| DQ runner | PARTIAL | EXTEND | `dataQuality.js` `runConversionDataQuality`; `CrmConversionDqIncident` |
| Missing match decisions | PARTIAL | EXTEND | Wave 4 deepen |
| Orphan / incomplete steps | PARTIAL | EXTEND | Wave 4 |
| Checksum drift (acceptance vs snapshot) | GAP | EXTEND | Wave 2–4 |
| Opp estimate as contracted amount | — | WRONG_SOURCE / FORBIDDEN | Must never drive Subscription |
| Gate fail invent KPIs | READY (forbidden) | CORRECT_AND_REUSABLE | Reliability gate null path |
| Null customer/tenant pre-provision | READY | CORRECT_AND_REUSABLE | Expected honesty |

**Implication:** DQ runner exists; Wave 4 expands incident coverage without inventing zeroes.
