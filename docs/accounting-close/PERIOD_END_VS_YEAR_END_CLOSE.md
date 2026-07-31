# Period-End vs Year-End Close

| | Period-end | Year-end |
|---|---|---|
| Cadence | Monthly / quarterly | Once per financial year |
| Implementation | Phase 8 Period Close Run | Phase 12 Year-End Close Run |
| Temporary IS accounts | **Not** closed (default) | Closed via Closing Journals |
| Profit → RE | No | Yes (once) |
| PCTB | No | Required |
| FY status | Unchanged | → CLOSED |
| Next year | N/A | Create/activate via calendar |

Do not run annual temporary-account closure every month unless a future approved policy flag requires it (not implemented as default).
