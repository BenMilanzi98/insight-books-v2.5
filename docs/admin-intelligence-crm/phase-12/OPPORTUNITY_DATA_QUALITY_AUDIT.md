# Opportunity Data Quality Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity required-field DQ | NOT_FOUND | No Opportunity store |
| Amount / currency completeness | NOT_FOUND | — |
| Close date provenance completeness | NOT_FOUND | — |
| Stage history completeness | NOT_FOUND | — |
| READY handoff field completeness | READY (upstream) | Typed payload with pinned versions + honesty flags |
| Lead DQ as Opportunity DQ | WRONG_DOMAIN | Related but distinct |
| Empty Pipeline as “0% DQ fail” | FORBIDDEN | Gate NOT_INSTRUMENTED |

**Implication:** Wave 1+ define DQ as Opportunity models land. Reliability envelopes must not invent zeroes when uninstrumented.
