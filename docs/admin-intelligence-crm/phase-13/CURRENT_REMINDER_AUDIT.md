# Current Reminder Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmReminder model | NOT_FOUND | Absent from Prisma |
| Reminder dedupe keys / snooze | NOT_FOUND | No `lib/admin/crm/reminders.js` |
| Reminder delivery ≠ Activity complete | NOT_FOUND (design locked) | Must enforce in Wave 4 |
| Subscription expiry reminder emails | WRONG_DOMAIN | `sendSubscriptionExpiryReminderEmail` in `lib/email.js` — billing/ops, not Sales Activity Reminder |
| UI/API | NOT_FOUND | No `/reminders` CRM hubs |

**Implication:** Wave 4 greenfield Reminders with dedupe; do not treat billing reminder emails as CRM Reminders.

