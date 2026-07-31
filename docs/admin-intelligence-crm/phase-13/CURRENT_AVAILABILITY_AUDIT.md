# Current Availability Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM working hours model | NOT_FOUND | No admin working-hours entity in CRM |
| Availability query (privacy-safe) | NOT_FOUND | No `getAvailability` in `lib/admin/crm` |
| Conflict detect (BLOCK/WARN/ALLOW_WITH_REASON) | NOT_FOUND | — |
| Channel availability (capture) | CORRECT_AND_REUSABLE (different sense) | `channelAvailability` in `catalogue.js` / `capture.js` = Email/WhatsApp ingest AVAILABLE vs NOT_AVAILABLE — not meeting-slot availability |
| Support SLA working hours | WRONG_DOMAIN | `SupportSlaCalendar.definitionJson` workingHours |

**Implication:** Wave 3 introduces Sales working hours + conflict policy; do not reuse Support SLA calendars.

