# Close Date Matrix

| Field / event | Required provenance | Wave | Class today |
|---------------|---------------------|------|-------------|
| Expected close date | Source (rep / stage rule / import) | 2 | NOT_FOUND |
| Confidence | Explicit band / enum | 2 | NOT_FOUND |
| Close date history | Immutable on change | 2 | NOT_FOUND |
| Actual close date | Set on Closed Won/Lost | 3 | NOT_FOUND |
| Fabricated forecast date for empty deals | — | — | FORBIDDEN |
| Task due date as close date | — | — | WRONG_DOMAIN auto |

**Rule:** No close date without source. No invented dates for charts.
