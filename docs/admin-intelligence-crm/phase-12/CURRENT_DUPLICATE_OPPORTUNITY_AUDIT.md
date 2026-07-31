# Current Duplicate Opportunity Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Duplicate Opportunity detection | NOT_FOUND | No Opportunity store |
| Opportunity merge | NOT_FOUND | — |
| Lead duplicate / merge | READY (upstream) | `CrmDuplicateCandidate` / `CrmMergeRequest` — Lead plane SoD |
| Silent Opportunity merge | FORBIDDEN | Carry Phase 11 SoD pattern |
| Idempotent create from same handoff key | NOT_FOUND (consumer) | Key READY on handoff; create path Wave 1 |

**Implication:** Wave 1 idempotent create prevents same-handoff duplicates; Wave 4 broader duplicate/merge with SoD. Never silent merge.
