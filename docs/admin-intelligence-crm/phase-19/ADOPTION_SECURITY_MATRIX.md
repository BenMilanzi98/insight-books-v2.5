# Adoption Security Matrix

| Control | Required | Current | Class | Wave |
|---------|----------|---------|-------|------|
| Route → permission map CS adoption | Present | Absent | NOT_FOUND | 1 |
| `loadAdoptionPlanForActor` / Request | Fail-closed | Absent | NOT_FOUND | 1 |
| Portfolio empty list | `[]` | Absent | NOT_FOUND | 1 |
| SoD critical waiver | Distinct actors | Absent | NOT_FOUND | 2 |
| SoD expansion ACK | Distinct where policy requires | Absent | NOT_FOUND | 3 |
| Idempotency keys | Exact retry same row | Absent | NOT_FOUND | 1–3 |
| Cross-Tenant denial | Deny | Absent | CROSS_TENANT_RISK | 1 |
| `resolveCrmScope` stub | Harden later | Present mode:all | CARRY | Harden |
| No Tenant GL | Boundary | Boundary | FORBIDDEN mutate | All |
| Phase 8 intervention ownership | Phase 8 APIs | READY | CORRECT_AND_REUSABLE | 3 |
| Model guards / SQL fallback | Windows EPERM | Absent | CARRY | 1 |
