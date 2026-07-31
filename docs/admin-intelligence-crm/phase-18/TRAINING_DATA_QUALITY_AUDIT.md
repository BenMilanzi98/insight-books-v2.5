# Training Data Quality Audit

**Audited:** 2026-07-31

| Rule area | Current state | Class |
|-----------|---------------|-------|
| Request required pins (Customer/Tenant/Subscription/source/handoff) | No Request model | NOT_FOUND — Wave 1 DQ |
| Handoff ↔ Request lineage | Emit only; no consume | UNRECONCILED until Wave 1 |
| Program curriculumVersionId present | No Program | NOT_FOUND — Wave 1 |
| Role-module vs entitlement | Absent | WRONG_SCOPE risk if skipped — Wave 1–2 |
| Participant verification before restricted access | Absent | NOT_FOUND — Wave 2 |
| Attendance source required; invite/RSVP/link rejected | Absent | ATTENDANCE_TRUTH_RISK |
| Assessment attempt limits server-side | Absent | ASSESSMENT_TRUTH_RISK |
| Final result immutable without regrade | Absent | ASSESSMENT_TRUTH_RISK |
| Completion without attendance/assessments/policy | Absent | COMPLETION_TRUTH_RISK |
| Certificate without ParticipantCompletion | Absent | CERTIFICATE_TRUTH_RISK |
| Onboarding COMPLETED without Phase 18 source | Gated in coordination | CORRECT_AND_REUSABLE / TRAINING_TRUTH_RISK |
| Phase 8 CsTrainingRecord COMPLETED without Program | Thin free status | UNRECONCILED / REUSE_WITH_RECONCILIATION — Wave 4 migrate or UNKNOWN |
| Handoff payload forge complete | Forced false | CORRECT_AND_REUSABLE |
| Conversion/onboarding DQ pattern | `conversions/dataQuality.js`, onboarding DQ | CORRECT_AND_REUSABLE pattern for Wave 4 |

**Disposition:** Implement DQ rules Waves 1–4 as domains appear; never invent green DQ scores when models unavailable → UNAVAILABLE / NOT_INSTRUMENTED.
