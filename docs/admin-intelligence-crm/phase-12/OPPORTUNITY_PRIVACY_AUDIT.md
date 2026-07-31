# Opportunity Privacy Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity PII fields | NOT_FOUND (store) | Will inherit Account/Contact PII via links |
| Consent / DNC on create | READY (upstream gate) | Readiness checks eligibility; DNC can BLOCK |
| Consent inferred from Opportunity stage | FORBIDDEN | Never infer GRANTED |
| Notes RESTRICTED projection | CORRECT_AND_REUSABLE pattern | Phase 11 CrmNote — extend to Opportunity notes |
| Export of Opportunity PII | NOT_FOUND | Must recheck consent/eligibility + audit |
| Tenant GL / payment / MRA secrets on Opportunity | FORBIDDEN | — |

**Implication:** Wave 1 create respects DNC/eligibility from readiness. Waves 3–4 notes/export preserve consent + restricted projection rules.
