# Current Task Model Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmTask Prisma model | FOUNDATION / EXTEND | `prisma/schema.prisma` `CrmTask` — subjectType/Id, title, status TODO/COMPLETED, dueAt, assignee, completedAt |
| Task service | EXTEND | `lib/admin/crm/tasks.js` — createTask, completeTask (idempotent alreadyCompleted), listTasks, hasCrmTaskModel |
| Status machine | PARTIAL | TODO → COMPLETED only (`CRM_TASK_STATUS`); no CANCELLED / IN_PROGRESS / reopen |
| Checklist / deps / recurrence | NOT_FOUND | No fields or modules under `lib/admin/crm` |
| Activity FK / ACT number | NOT_FOUND | No activityId on CrmTask |
| Opportunity-scoped tasks | EXTEND | `opportunities/tasks.js` + API `app/api/admin/crm/opportunities/[id]/tasks` |
| Lead/general tasks API | FOUNDATION | `app/api/admin/crm/tasks` + complete route |
| My-work filter | FOUNDATION | `listTasks({ myWork: true })` filters assigneeAdminId |
| Overdue auto-complete | CORRECT_AND_REUSABLE (absent = good) | Due date pass does not complete — service only completes on explicit completeTask |
| Sales sequences / cadences | NOT_FOUND / FORBIDDEN invent | Explicitly out of Phase 11 foundations |
| CsTask reuse | WRONG_DOMAIN / FORBIDDEN | `CsTask` OPEN-status tenant CS plane — never alias as CrmTask |

**Implication:** Wave 1 links CrmTask → CrmActivity; extend statuses carefully; keep CsTask strictly out of domain.

