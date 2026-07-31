# Current Onboarding Workstream Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding Workstream model | NOT_FOUND | — |
| Governance / tenant / migration / MRA / training / go-live workstream catalogue | NOT_FOUND | Spec only |
| Materialisation from template | NOT_FOUND | — |
| Workstream progress / dependencies | NOT_FOUND | — |
| CS playbooks as substitute | WRONG_DOMAIN | `lib/admin/customerSuccess/playbooks.js` — CS interventions ≠ onboarding workstreams |
| Idempotent materialise once | NOT_FOUND | Exact-retry contract Wave 2 |

**Implication:** Wave 2 materialise workstreams from template version; do not reuse playbooks as onboarding truth.
