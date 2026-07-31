# Activity Domain Matrix

| Concept | CRM Sales plane | Other plane | Class |
|---------|-----------------|-------------|-------|
| CrmActivity | Target Wave 1 | — | NOT_FOUND → build |
| CrmTask | `lib/admin/crm/tasks.js` | CsTask | EXTEND vs WRONG_DOMAIN |
| CrmNote | `notes.js` | Support messages | EXTEND vs WRONG_DOMAIN |
| CrmTimelineEvent | `timeline.js` | Analytics events | EXTEND vs WRONG_DOMAIN |
| Follow-Up / Next-Action | Target Wave 1 | CS playbook steps | NOT_FOUND vs WRONG_DOMAIN |
| Call Activity | Target Wave 2 | Support phone / CS intervention | NOT_FOUND vs WRONG_DOMAIN |
| Email Activity | Target Wave 2 | Transactional `lib/email*` | NOT_FOUND vs WRONG_DOMAIN |
| Meeting | Target Wave 3 | Demo (Phase 14) | NOT_FOUND; Demo handoff only |
| Calendar | Target Wave 3 | SupportSlaCalendar | NOT_FOUND vs WRONG_DOMAIN |
| Reminder | Target Wave 4 | Subscription email reminders | NOT_FOUND vs WRONG_DOMAIN |
| Consent / DNC / eligibility | `consent.js` / `eligibility.js` | — | CORRECT_AND_REUSABLE |
| Pipeline Opportunity | Phase 12 | — | CORRECT_AND_REUSABLE relation target |
| Lead / Account / Contact | Phases 11 | — | CORRECT_AND_REUSABLE relation targets |
| Audit Event | — | System audit | ≠ Activity |
| Analytics Event | — | Product/platform analytics | ≠ Activity |

**Rule:** Extend `lib/admin/crm/*` only. Do not alias Support/CS/analytics/POS as Sales Activity.

