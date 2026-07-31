# Current Onboarding MRA EIS Coordination Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding MRA readiness checklist | NOT_FOUND | Spec `mraEis.js` under onboarding absent |
| Phase 16 MRA_EIS handoff | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/mraEisHandoff.js` — `fiscalSubmitted/credentialsStored: false` |
| Tenant MRA EIS domain | WRONG_DOMAIN for onboarding execution | Large `lib/mraEis/**` — fiscal/activation/transmission; onboarding coordinates only |
| Credential status boundary | EXTEND | Handoff forbids storing credentials; onboarding must not store Production secrets |
| UNKNOWN treated as READY | GO_LIVE_TRUTH_RISK / FORBIDDEN | Wave 3 |
| Unauthorised Production fiscal submit | FORBIDDEN | Handoff meta `mraFiscalForbidden: true` |
| MRA endpoint keys `EP-ONB-*` | WRONG_DOMAIN | Activation mapper endpoint keys — not onboarding Project numbers |

**Implication:** Wave 3 readiness refs + typed credential status; never fabricate READY; never submit fiscal from onboarding.
