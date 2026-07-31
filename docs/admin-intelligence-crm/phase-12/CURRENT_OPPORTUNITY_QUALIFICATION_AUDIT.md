# Current Opportunity Qualification Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity-stage qualification | NOT_FOUND | No Opportunity qual engine |
| Lead qualification (versioned) | READY (upstream) | Phase 11 `CrmQualification*` — input to READY handoff |
| Score evaluation | READY (upstream) | Deterministic Lead fit — ≠ Opportunity qualification |
| Re-qualify Opportunity independently | NOT_FOUND | Design may reuse Lead pins + Opportunity criteria later |
| AI qualification | FORBIDDEN | — |

**Implication:** Wave 1 create consumes pinned Lead qualification/score versions from handoff. Opportunity-specific qualification (if any) must not silently overwrite Lead history.
