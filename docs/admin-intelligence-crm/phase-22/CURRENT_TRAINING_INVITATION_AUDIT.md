# Current Training Invitation Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Invitation model/service | NOT_FOUND | No CustomerTrainingInvitation / invitations.js under training/** |
| Queued≠sent≠delivered≠registered | GAP | PRD/design required distinct states — absent |
| Invitation as attendance source | CORRECT_AND_REUSABLE guard | TRAINING_ATTENDANCE_FORBIDDEN_SOURCES includes INVITATION_DELIVERY |
| Idempotent invite send | NOT_FOUND | Wave 2 |

**Implication:** Invitation lifecycle is a Critical/High Wave 2 gap; attendance forbid-list already rejects invitation delivery as attendance.

