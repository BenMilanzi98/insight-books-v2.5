# Demo Data Quality Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo DQ service | NOT_FOUND | No `demos/dataQuality.js` |
| Activity DQ pattern | CORRECT_AND_REUSABLE pattern | `lib/admin/crm/activities/dataQuality.js` honesty-gated |
| CRM recon honesty helper | CORRECT_AND_REUSABLE | Shared recon honesty patterns in CRM |
| Lead DEMO_REQUEST volume as Demo DQ | PARTIAL / mislabel risk | Lead counts ≠ Demo Request DMR counts until Wave 1 |
| Orphan Meeting "demos" | N/A | Meetings are not Demos — DQ must not count Meetings as Demos |
| Duplicate Demo Requests | NOT_FOUND | Convert/qualify idempotency Wave 1 |
| Env expiry overdue | NOT_FOUND | Wave 3 |

**Implication:** Wave 4 Demo DQ foundations; never invent DQ scores; Lead DEMO_REQUEST is capture quality, not Demo delivery quality.
