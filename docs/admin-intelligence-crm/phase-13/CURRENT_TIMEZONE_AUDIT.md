# Current Timezone Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Activity timezone fields (UTC + display + original) | NOT_FOUND | CrmTask.dueAt is bare DateTime — no zone metadata |
| Contact preferred timezone | NOT_FOUND | `CrmCommunicationPreference` has channel/preference only — no timezone column |
| Admin working timezone | NOT_FOUND | No CRM admin TZ preference for scheduling |
| Eligibility timezone check | NOT_FOUND | `eligibility.js` checks consent/DNC only — not quiet hours / TZ |
| Support SLA timezone | WRONG_DOMAIN | `SupportSlaCalendar.timezone` for ticket clocks |
| Demo-request locale formatting | WRONG_DOMAIN | `app/api/contact/demo-request` uses `timeZoneName: 'short'` for email copy — not CRM Activity TZ |

**Implication:** Wave 1–3 must store explicit timezones on Activities/Meetings; end-before-start blocked; never silently assume server local TZ as Contact TZ.

