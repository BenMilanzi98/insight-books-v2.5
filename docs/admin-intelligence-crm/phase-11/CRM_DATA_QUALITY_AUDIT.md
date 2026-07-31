# CRM Data Quality Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Lead required-field DQ rules | NOT_FOUND | No Lead store |
| Email/phone format on persisted Lead | PARTIAL (ingress only) | Demo-request validates email format before email send |
| Orphan Account / Contact detection | NOT_FOUND | — |
| Source code completeness | NOT_FOUND | — |
| Consent completeness vs channel | NOT_FOUND | — |
| Duplicate rate monitoring | NOT_FOUND | — |
| Tenant Client DQ as CRM DQ | WRONG_DOMAIN | — |
| Empty CRM plane as “0% DQ fail” | FORBIDDEN | Gate NOT_INSTRUMENTED |

**Implication:** Wave 1+ define DQ checks as models land. Reliability envelopes must not invent zeroes when CRM uninstrumented.
