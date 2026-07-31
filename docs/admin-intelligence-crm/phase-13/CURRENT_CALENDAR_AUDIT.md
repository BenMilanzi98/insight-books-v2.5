# Current Calendar Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmCalendarEvent model | NOT_FOUND | Absent from Prisma |
| Internal calendar queries (day/week/month/agenda) | NOT_FOUND | No `lib/admin/crm/calendar/*` |
| ICS export | NOT_FOUND | No CRM ICS exporter |
| Google Calendar sync | NOT_CONNECTED / NOT_FOUND | No CRM Google integration |
| Outlook sync | NOT_CONNECTED / NOT_FOUND | No CRM Outlook integration |
| SupportSlaCalendar | WRONG_DOMAIN / FORBIDDEN | `SupportSlaCalendar` — SLA business calendar for ticket clocks (`prisma` + `lib/admin/support/sla`); timezone/workingHours for Support SLA only |
| UI/API | NOT_FOUND | No `/insightbooks/crm/calendar` |

**Implication:** Wave 3 builds internal CRM calendar + ICS; expose Google/Outlook status as NOT_CONNECTED; never reuse SupportSlaCalendar as Sales calendar.

