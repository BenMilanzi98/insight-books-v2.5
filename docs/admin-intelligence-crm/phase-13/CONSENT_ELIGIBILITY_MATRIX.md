# Consent & Eligibility Matrix

| Input | Blocking? | Evidence | Class |
|-------|-----------|----------|-------|
| Consent UNKNOWN | YES block | `BLOCKING_CONSENT` in `eligibility.js` | CORRECT_AND_REUSABLE |
| Consent DENIED / WITHDRAWN / EXPIRED / PENDING | YES block | Same | CORRECT_AND_REUSABLE |
| Consent GRANTED + source | Allow (if no DNC) | `recordConsent` requires source | CORRECT_AND_REUSABLE |
| Inferred GRANTED | FORBIDDEN | `consent_inferred_forbidden` | CORRECT_AND_REUSABLE |
| DO_NOT_CONTACT_ALL | YES block | DNC flags | CORRECT_AND_REUSABLE |
| DO_NOT_EMAIL / CALL / WHATSAPP / SMS | Channel block | CHANNEL_TO_DNC map | CORRECT_AND_REUSABLE |
| Email/phone presence alone | Never grants | Consent docs + service | CORRECT_AND_REUSABLE |
| Outbound Email Activity | No consumer yet | Wave 2 must call gate + persist | PARTIAL |
| Outbound Call Activity | No consumer yet | Wave 2 | PARTIAL |
| Meeting invitation | No consumer yet | Wave 3 | PARTIAL |
| Follow-Up auto-execute when blocked | Must not | Wave 1 policy | NOT_FOUND → enforce |
| Quiet hours / Contact TZ | Not checked | Wave 1–3 extend | NOT_FOUND |

**Rule:** Persist eligibility decision on outbound Actions. UNKNOWN ≠ granted.

