# Demo Security Matrix

| Control | Today | Wave need | Class |
|---------|-------|-----------|-------|
| FLS Demo APIs | N/A (absent) | All waves | NOT_FOUND → require |
| CRM authz reuse | Present | Extend keys for demos | CORRECT_AND_REUSABLE / EXTEND |
| Owner/team/territory scope | Stub `mode: 'all'` | Harden for Demo lists | PARTIAL / CARRY |
| Restricted Script projection | Absent | Wave 2 fail-closed | NOT_FOUND |
| Recording consent gate | Absent | Wave 4 | NOT_FOUND |
| Env credential protection | Absent | Wave 3 | NOT_FOUND |
| Production connection guards | Absent | Wave 3 | NOT_FOUND |
| SoD content/env approve | Automation SoD pattern | Waves 2–3 | FOUNDATION pattern |
| Export permission recheck | Lead export pattern | Demo export | FOUNDATION pattern |
| Cross-Tenant subjects | Must block | All waves | FORBIDDEN if attempted |
| CoA / payment / MRA secrets | Removed/forbidden | Keep off Demo | FORBIDDEN |
| MRA sandbox ACL reuse | Separate | Never authorize Demo | WRONG_DOMAIN |
| SQL + hasCrm*Model guards | P13 pattern | All Demo models | CARRY / EXTEND |
