# Current Demo Scheduling Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo.schedule → Meeting link | NOT_FOUND | No Demo entity to link |
| Required Meeting on schedule | NOT_FOUND (design locked) | Spec: schedule must create/reconcile CrmMeeting + Calendar Event |
| CrmMeeting create/reschedule | READY / EXTEND | `lib/admin/crm/meetings/service.js` `createMeeting`, `rescheduleMeeting`; APIs `/api/admin/crm/meetings` |
| Calendar Event + conflicts | READY / EXTEND | `lib/admin/crm/calendar/service.js`; conflict detect; ICS export |
| Timezone model (Meeting) | READY / EXTEND | Meeting service: explicit timezone; end-before-start blocked |
| Google / Outlook sync | NOT_CONNECTED | `CRM_CALENDAR_INTEGRATION_STATUS = 'NOT_CONNECTED'`; foundations meta |
| Meeting ≠ Demo | CORRECT_AND_REUSABLE | `meetings/index.js`; P13 `MEETING_STATE_MATRIX` "Demo Meeting FORBIDDEN alias" |
| Demo calendar hub | NOT_FOUND | CRM calendar hubs exist for Activity Meetings only (`/insightbooks/crm/calendar/*`) |
| Availability / working hours | FOUNDATION (P13) | Calendar availability — reuse for Demo schedule conflicts; not Demo-specific |

**Implication:** Wave 1 `scheduleDemo` must call Phase 13 Meeting + Calendar; reconcile Demo start/end/timezone with Meeting. Never invent external calendar CONNECTED.
