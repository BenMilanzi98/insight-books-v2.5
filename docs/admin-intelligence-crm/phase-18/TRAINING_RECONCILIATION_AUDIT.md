# Training Reconciliation Audit

**Audited:** 2026-07-31

| Reconciliation pair | Current | Class | Wave |
|---------------------|---------|-------|------|
| TRAINING handoff ↔ Training Request | Emit only | UNRECONCILED | 1 |
| Request ↔ Program (1:1 convert) | Absent | NOT_FOUND | 1 |
| Program ↔ curriculumVersion / moduleVersions | Absent | NOT_FOUND / UNVERSIONED | 1 |
| Program ↔ entitlement / Product scope | Absent | UNRECONCILED | 1–2 |
| Session ↔ CrmMeeting | Absent | NOT_FOUND | 2 |
| Attendance ↔ Session + source evidence | Absent | ATTENDANCE_TRUTH_RISK | 2 |
| Assessment Result ↔ Attempt + policy | Absent | ASSESSMENT_TRUTH_RISK | 3 |
| Certificate ↔ ParticipantCompletion + checksum | Absent | CERTIFICATE_TRUTH_RISK | 3 |
| Program outcome ↔ Phase 17 `CustomerOnboardingTraining` | Gate exists; no publisher | UNRECONCILED / EXTEND | 3 |
| CsTrainingRecord ↔ Program | No `trainingProgramId` | UNRECONCILED | 4 |
| Metrics ↔ reliability gate freshness | Absent | NOT_FOUND | 4 |
| Exports ↔ permission watermark | Absent | NOT_FOUND | 4 |

**Disposition:** Wave 4 `reconciliation.js` + lineage; gate fail → UNAVAILABLE, never false reconciled-green.
