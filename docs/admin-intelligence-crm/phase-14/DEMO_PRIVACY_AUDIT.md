# Demo Privacy Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo-specific privacy controls | NOT_FOUND | No Demo plane |
| Consent / DNC / prefs | CORRECT_AND_REUSABLE | `lib/admin/crm/consent.js` |
| Eligibility gate outbound | CORRECT_AND_REUSABLE | `eligibility.js` — invitations / follow-up emails |
| Recording consent separate from RSVP | NOT_FOUND (design) | Wave 4 |
| Restricted Script exposure | NOT_FOUND (must enforce) | Wave 2 — never on Customer APIs / invitations |
| Restricted Notes pattern | CORRECT_AND_REUSABLE | `notes.js` INTERNAL/RESTRICTED — pattern for restricted Demo content |
| Public capture PII | FOUNDATION | `capture.js` sanitizes; throttle; idempotent — Lead PII, not Demo env PII |
| Production customer data in Demo env | FORBIDDEN | Wave 3 reject |
| Tracking pixels on Demo emails | FORBIDDEN | Email Activity: pixels off |

**Implication:** Privacy fail-closed; recording UNKNOWN ≠ GRANTED; no Production PII in Demo packs; restricted content never customer-facing.
