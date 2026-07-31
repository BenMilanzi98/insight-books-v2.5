# Activity Security Matrix

| Control | Today | Wave need | Class |
|---------|-------|-----------|-------|
| FLS Activity APIs | N/A (absent) | All waves | NOT_FOUND → require |
| Task/Note authz | Present | Keep + Activity keys | FOUNDATION / EXTEND |
| Restricted notes | Present | Preserve under Activity | CORRECT_AND_REUSABLE |
| Consent manage permission | Present | Outbound Waves | CORRECT_AND_REUSABLE |
| Owner/team/territory scope | Stub `mode: 'all'` | Harden for lists | PARTIAL / CARRY |
| Automation SoD | Absent | Wave 4 | NOT_FOUND |
| Export permission recheck | Lead export | Activity export later | FOUNDATION pattern |
| Cross-Tenant subjects | Must block | All waves | FORBIDDEN if attempted |
| CoA / payment / MRA secrets | Removed/forbidden | Keep off Activity | FORBIDDEN |
| Support ACL reuse | Separate | Never | WRONG_DOMAIN |

