# Current Training Participant Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Participant verify | CORRECT_AND_REUSABLE / EXTEND | `participants.js` verificationState PENDING/VERIFIED/UNKNOWN/REJECTED |
| Dedupe identityKey | CORRECT_AND_REUSABLE | @@unique([programId, identityKey]) |
| UNKNOWN blocks restricted | EXTEND | Enrolment path checks verification |
| Consent ≠ Marketing consent | GAP / EXTEND | No explicit marketing-consent boundary field yet (Phase 23 prep) |
| Participants ≠ auto Leads | CORRECT_AND_REUSABLE rule | No Lead create from training modules observed |

**Implication:** Participant identity plane reusable; Wave 2 deepens consent/PII projections.

