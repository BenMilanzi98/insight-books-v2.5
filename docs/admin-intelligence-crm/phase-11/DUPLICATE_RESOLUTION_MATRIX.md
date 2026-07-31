# Duplicate Resolution Matrix (planned)

| Signal | Candidate? | Auto-merge? | Wave | Class today |
|--------|------------|-------------|------|-------------|
| Exact idempotency key retry | Return existing Lead | N/A (idempotent create) | 2 | NOT_FOUND |
| Same email + similar name | Yes | Never | 2 | NOT_FOUND |
| Same phone normalized | Yes | Never | 2 | NOT_FOUND |
| Same Account domain heuristic | Yes (low confidence) | Never | 2–4 | NOT_FOUND |
| Reviewer merge approve | Merge with SoD | Controlled only | 4 | NOT_FOUND |
| Support ticket merge | — | — | — | WRONG_DOMAIN |
| Silent merge on capture | Forbidden | Forbidden | — | — |

**Rule:** No silent merges; evidence preserved on both survivors/losers per merge policy.
