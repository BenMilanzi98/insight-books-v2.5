# Current CRM Note Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmNote model | FOUNDATION / EXTEND | `CrmNote` — subjectType/Id, body, visibility INTERNAL/RESTRICTED |
| Note service | EXTEND | `lib/admin/crm/notes.js` — createNote, listNotes, projectNotesForViewer, hasCrmNoteModel |
| Restricted projection | CORRECT_AND_REUSABLE | Fail-closed omit/redact without `canViewRestrictedNotes` |
| Authz | CORRECT_AND_REUSABLE | `canAddInternalNotes` / `canAddRestrictedNotes` in `authz.js` |
| Timeline NOTE_ADDED | EXTEND | Appended on create |
| Activity parent link | NOT_FOUND | No activityId; Note ≠ outbound communication (preserve) |
| Customer API exposure | CORRECT_AND_REUSABLE (absent) | Notes are admin CRM APIs only — keep off Customer APIs / invitations / default exports |
| UI | PARTIAL | Notes via APIs; no dedicated `/notes` hub page under crm |

**Implication:** Wave 1 links Notes under Activity type NOTE; preserve INTERNAL/RESTRICTED security; never treat Note as Email/Call.

