# Onboarding MRA Matrix

| Concern | Onboarding role | Current | Class |
|---------|-----------------|---------|-------|
| Consume MRA_EIS handoff | Yes | Emit only | CORRECT_AND_REUSABLE |
| Readiness checklist | Yes | Absent | NOT_FOUND |
| Credential status boundary | Status only | Handoff forbids store | CORRECT_AND_REUSABLE |
| Store Production credentials | No | Forbidden | FORBIDDEN |
| Production fiscal submit | No | Forbidden on handoff | FORBIDDEN |
| UNKNOWN → READY | No | — | GO_LIVE_TRUTH_RISK |
| Call approved MRA services for status | Yes (readiness) | `lib/mraEis/**` exists | REUSE_WITH_RECONCILIATION / WRONG_DOMAIN for fiscal |
| Endpoint keys EP-ONB-* | N/A | Activation mapper | WRONG_DOMAIN vs Project ONB- |
