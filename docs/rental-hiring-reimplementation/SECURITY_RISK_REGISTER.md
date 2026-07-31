# Security Risk Register

| ID | Risk | Severity | Disposition |
|----|------|----------|-------------|
| S-01 | Coarse permissions only (`rentals.*`) | Medium | `EXTEND` fine-grained |
| S-02 | No SoD (book/approve/dispatch/refund) | High | `REIMPLEMENT` |
| S-03 | Price override without approval | Medium | `EXTEND` |
| S-04 | Status mutation via complete/cancel | Medium | State machine |
| S-05 | No dedicated auditor read-only path | Medium | `EXTEND` |
| S-06 | Automated IDOR suite missing | High | Add tests |
| S-07 | Document/attachment pipeline absent | Medium | When added: private storage |

Server mostly reloads session + tenantId — pattern is sound for existing endpoints (`REUSE` pattern).
