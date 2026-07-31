# Pipeline Version Matrix

| Pipeline code | Status (planned) | Wave | Class today |
|---------------|------------------|------|-------------|
| NEW_BUSINESS | ACTIVE first | 1 | NOT_FOUND |
| EXPANSION | Later in-phase | 4 | NOT_FOUND |
| MRA_EIS | Later in-phase | 4 | NOT_FOUND |
| Version pin on Opportunity | Required | 1 | NOT_FOUND |
| Stage set bound to Pipeline version | Required | 1 | NOT_FOUND |
| Hot-edit live stages without version | Forbidden | All | FORBIDDEN (planned) |

**Rule:** Opportunities pin Pipeline version at create/transition. Catalogue changes publish new versions; do not mutate historical stage semantics in place.
