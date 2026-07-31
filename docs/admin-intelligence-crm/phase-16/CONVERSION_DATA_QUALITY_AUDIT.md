# Conversion Data Quality Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion DQ runner | NOT_FOUND | — |
| Commercial DQ pattern | CORRECT_AND_REUSABLE | `commercial/dataQuality.js` |
| Accepted version/checksum integrity | CORRECT_AND_REUSABLE | Acceptance + readiness blockers |
| Opp estimate as contracted truth | WRONG_SOURCE | Must not drive Subscription amounts |
| Null customer/tenant on handoff | CORRECT_AND_REUSABLE honesty | Expected pre-conversion |

**Implication:** Wave 4 DQ for missing match decisions, orphan steps, checksum drift; never invent KPIs.
