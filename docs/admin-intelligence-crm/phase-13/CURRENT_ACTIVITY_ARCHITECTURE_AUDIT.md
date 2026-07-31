# Current Activity Architecture Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Canonical CrmActivity parent | NOT_FOUND | No `CrmActivity` / `ACT-` numbering in Prisma or `lib/admin/crm` |
| Typed Activity children plane | NOT_FOUND | No CrmCall / CrmFollowUp / CrmEmailActivity / CrmMeeting / CrmCalendarEvent |
| Lead/Account/Contact/Opportunity subject tasks | FOUNDATION / EXTEND | `CrmTask` polymorphic `subjectType`+`subjectId` — LEAD/ACCOUNT/CONTACT/OPPORTUNITY (`catalogue.js` CRM_SUBJECT_TYPE) |
| Opportunity task bridge | EXTEND | `lib/admin/crm/opportunities/tasks.js` — `subjectType: OPPORTUNITY`; no Lead auto-clone |
| Timeline projection | FOUNDATION / EXTEND | `CrmTimelineEvent` + `lib/admin/crm/timeline.js`; Opportunity events in `opportunities/timeline.js` |
| Notes as Activity-adjacent | FOUNDATION / EXTEND | `CrmNote` INTERNAL/RESTRICTED; not outbound |
| Activity hub UI | NOT_FOUND | No `/insightbooks/crm/activities` (or tasks/calls/emails/meetings/calendar hubs) under `app/insightbooks/crm` |
| Activity APIs | NOT_FOUND | No `app/api/admin/crm/activities/**`; tasks/notes/timeline/consent/eligibility APIs exist |
| Support/CS as Activity | WRONG_DOMAIN / FORBIDDEN | `CsTask` (`lib/admin/customerSuccess/tasks.js`); Support tickets/messages |
| Analytics / POS as Activity | WRONG_DOMAIN | analytics-pipeline; Tenant POS `sales.*` |
| One Activity / many projections rule | NOT_FOUND | Design locked; not implemented — Wave 1 |

**Implication:** Wave 1 introduces `CrmActivity` spine and migrates Task/Note under it. Do not invent Activity volume from Support/CS or analytics.

