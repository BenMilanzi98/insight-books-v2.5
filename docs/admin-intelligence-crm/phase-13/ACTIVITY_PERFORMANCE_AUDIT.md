# Activity Performance Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Task list pagination | FOUNDATION | limit/offset with CRM_LIST_MAX_LIMIT |
| Timeline pagination | FOUNDATION | Same pattern in `timeline.js` |
| Activity hub unbounded queries | N/A | Hubs not built — Wave 1–3 must bound calendar/agenda queries |
| Calendar range queries | NOT_FOUND | Must be bounded (day/week/month) in Wave 3 |
| N+1 risk on entity panels | PARTIAL | Opportunity get may compose risks/tasks/timeline — watch Activity expansions |
| Index coverage (tasks) | FOUNDATION | Indexes on subjectType+subjectId+status; assignee+status; status+dueAt |

**Implication:** Enforce server pagination/filter/sort; bound calendar windows; avoid loading Support/CS threads into CRM timelines.

