# Activity Data Quality Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Activity DQ rules engine | NOT_FOUND | No Activity-specific DQ |
| Lead/Opportunity DQ adjacent | PARTIAL | Opportunity readiness / risk / recon patterns exist — not engagement DQ |
| Orphan tasks (subject missing) | NOT_INSTRUMENTED | CrmTask has no FK to Lead/Opportunity — soft subject refs |
| Completed without completedAt | NOT_INSTRUMENTED | Service sets completedAt on complete; no recon card |
| Planned-as-completed Calls/Emails | N/A today | Models absent — Wave 2 must block future-as-completed |
| Duplicate timeline noise risk | PARTIAL | Timeline appends per task/note — Activity spine must avoid duplicate Activity rows per view |

**Implication:** Wave 4 DQ rules + Wave 1 schema FKs/guards where needed; honesty over invented cleanliness scores.

