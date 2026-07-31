# Current Adoption Dormancy Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dormancy recovery case entity | NOT_FOUND | — |
| `listDormancyRiskQueue` / `openDormancyRecoveryCase` | NOT_FOUND | — |
| Phase 9 inactive-class signals | CORRECT_AND_REUSABLE | `signals.js` `VALUE_THEN_INACTIVE` (+ related codes) |
| Analytics missing → empty-as-healthy | FORBIDDEN | DORMANCY_TRUTH_RISK — must be UNAVAILABLE |
| RECOVERED without usage-return / attestation | FORBIDDEN | Design lock |

**Implication:** Wave 3 dormancy lifecycle OPEN → INTERVENTION_LINKED → MONITORING → RECOVERED|ESCALATED|CLOSED_UNRESOLVED with evidence gates.
