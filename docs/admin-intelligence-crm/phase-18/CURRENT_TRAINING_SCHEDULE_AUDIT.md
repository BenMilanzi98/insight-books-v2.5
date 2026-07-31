# Current Training Schedule Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training schedule / calendar hub | NOT_FOUND | No Training schedule service; Wave 4 Calendar/Today/Upcoming UI |
| Phase 13 Calendar reuse | CORRECT_AND_REUSABLE | `lib/admin/crm/meetings/*` + CRM calendar for Session Meetings |
| Conflict evaluation (trainer/participant/venue/capacity/timezone/prereq/env) | NOT_FOUND | Wave 2 `conflicts.js` |
| Timezone explicit on Sessions | NOT_FOUND | Design requires explicit timezone |

**Implication:** Wave 2 scheduling + conflicts; Wave 4 calendar hubs. Calendar Event alone ≠ delivery.
