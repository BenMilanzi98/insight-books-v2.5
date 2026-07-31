# Training Domain Matrix

| Domain object | Authoritative plane | Current | Class |
|---------------|---------------------|---------|-------|
| TRAINING handoff | Phase 16 conversions | Emit exists | CORRECT_AND_REUSABLE |
| Training Request / Program | Phase 18 Training | Absent | NOT_FOUND |
| Curriculum / Module versions | Phase 18 Training | Absent | NOT_FOUND |
| Cohort / Participant / Trainer | Phase 18 Training | Absent | NOT_FOUND |
| Session Meeting | Phase 13 Meetings | Service exists; Session link absent | CORRECT_AND_REUSABLE / NOT_FOUND |
| Attendance / Assessment / Cert | Phase 18 Training | Absent | NOT_FOUND |
| Onboarding training coordination | Phase 17 | Gate exists | CORRECT_AND_REUSABLE |
| CsTrainingRecord | Phase 8 foundations | Thin rows | REUSE_WITH_RECONCILIATION |
| CS Case / Support Ticket | CS / Support | Exist | WRONG_DOMAIN as Training truth |
| Subscription / Entitlement | Commercial | Exist | CORRECT_AND_REUSABLE pins — no mutate from Training |
| Tenant GL / CoA | Accounting | Boundary | FORBIDDEN from Training |
