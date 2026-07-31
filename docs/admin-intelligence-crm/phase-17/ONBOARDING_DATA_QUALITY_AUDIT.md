# Onboarding Data Quality Audit

**Audited:** 2026-07-31

| Rule area | Current state | Class |
|-----------|---------------|-------|
| Request required pins (Customer/Tenant/Subscription/source) | No Request model | NOT_FOUND — Wave 1 DQ |
| Handoff ↔ Request lineage | Emit only; no consume | UNRECONCILED until Wave 1 |
| Project templateVersionId present | No Project | NOT_FOUND — Wave 1 |
| Task completionSource required for CUSTOMER | No tasks | NOT_FOUND — Wave 2; TASK_COMPLETION_TRUTH_RISK if skipped |
| Milestone evidence before complete | Absent | MILESTONE_TRUTH_RISK |
| Migration recon before COMPLETED | Absent | MIGRATION_TRUTH_RISK |
| Training COMPLETED without Training source | Absent / must forbid | TRAINING_TRUTH_RISK |
| Go-live UNKNOWN≠READY | Absent | GO_LIVE_TRUTH_RISK |
| Completion without sign-off/handover/recon | Absent | COMPLETION_TRUTH_RISK |
| Phase 8 checklist COMPLETED without evidence | Thin rows allow free `status`/`completedAt` | UNRECONCILED / REUSE_WITH_RECONCILIATION — Wave 4 migrate or UNKNOWN |
| Conversion handoff payload forge complete | Forced false | CORRECT_AND_REUSABLE |
| Conversion DQ pattern | `conversions/dataQuality.js` | CORRECT_AND_REUSABLE pattern for Wave 4 |

**Disposition:** Implement DQ rules Waves 1–4 as domains appear; never invent green DQ scores when models unavailable → UNAVAILABLE / NOT_INSTRUMENTED.
