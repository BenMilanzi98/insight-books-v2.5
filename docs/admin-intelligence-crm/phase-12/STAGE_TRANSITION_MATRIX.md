# Stage Transition Matrix (planned governance)

| Transition type | Authoriser | Persist path | History | Class today |
|-----------------|------------|--------------|---------|-------------|
| Forward (criteria met) | Server transition service | API only | Immutable append | NOT_FOUND |
| Skip / jump | Server + criteria | API only | Immutable | NOT_FOUND |
| Backward | Server + policy | API only | Immutable | NOT_FOUND |
| Board drag | UI intent only | Must call server; deny if invalid | Same | NOT_FOUND |
| Client localStorage stage | — | Forbidden | — | FORBIDDEN |
| Closed → open reopen | Server + evidence/policy | API | Immutable | NOT_FOUND |
| Lead status change as stage move | — | Forbidden alias | — | WRONG_DOMAIN |

**Rule:** Drag-and-drop never persists without server OK. Invalid criteria → deny, no silent coerce.
