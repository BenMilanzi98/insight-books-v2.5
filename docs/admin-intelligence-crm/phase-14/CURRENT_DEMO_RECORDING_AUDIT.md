# Current Demo Recording Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo recording governance (request/consent/approve/deny) | NOT_FOUND | No Demo recording models |
| Recording media provider | NOT_AVAILABLE | Design locked; Call recording also `CRM_CALL_RECORDING_STATUS = 'NOT_AVAILABLE'` |
| Recording files / storage | NOT_AVAILABLE / FORBIDDEN invent | Must not fabricate files |
| Call recording boundary | WRONG_DOMAIN / NOT_AVAILABLE | `lib/admin/crm/calls/*` telephony recording — Call plane, not Demo recording |
| Consent UNKNOWN ≠ GRANTED | CORRECT_AND_REUSABLE | `consent.js` / eligibility fail-closed — reuse for recording consent |
| Recording off by default | NOT_FOUND (design locked) | Wave 4 default OFF |
| Foundations recording flag | CORRECT_AND_REUSABLE | `foundations.js` ACTIVITY_SPINE `recording: 'NOT_AVAILABLE'` |

**Implication:** Wave 4 governance-only; provider stays NOT_AVAILABLE; UNKNOWN consent ≠ GRANTED; no fabricated recordings.
