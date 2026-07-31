# Current Tasks Audit

| Check | Result | Evidence |
|-------|--------|----------|
| CS task model | NOT_FOUND | No `CsTask` in Prisma |
| Admin task queues for CS | NOT_FOUND | — |
| Closest | CustomerSignal state | ACK/DISMISS/RESOLVED_BY_SOURCE — not assignable work items |

**Disposition:** Wave 3 introduce `CsTask` linked to cases/playbook executions; portfolio-scoped assignee = System Admin user id.
