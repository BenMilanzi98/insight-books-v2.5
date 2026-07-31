# Task State Matrix

| From → To | Allowed today | Wave 1+ target | Notes |
|-----------|---------------|----------------|-------|
| (create) → TODO | YES | YES | `createTask` |
| TODO → COMPLETED | YES | YES | `completeTask`; idempotent if already COMPLETED |
| COMPLETED → TODO (reopen) | NO | Wave 1 if scoped | Not implemented |
| * → CANCELLED | NO | Optional later | NOT_FOUND |
| Due past → COMPLETED | NO (correct) | NO | Due ≠ complete |
| CsTask OPEN → … | WRONG_DOMAIN | Never map | Separate status vocabulary |

**Compatibility:** Fail-closed on unknown status. Activity parent status transitions are separate (Wave 1 catalogue).

