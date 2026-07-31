# Current Training Session Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training Session model | NOT_FOUND | No Session tables/services |
| `scheduleTrainingSession` → CrmMeeting | NOT_FOUND | Must link Phase 13 Meeting; unavailable → `MEETING_SERVICE_UNAVAILABLE` |
| Phase 13 Meetings service | CORRECT_AND_REUSABLE | `lib/admin/crm/meetings/service.js` (+ catalogue/model/numbering/index) |
| Onboarding kick-off as Training Session | WRONG_DOMAIN | `onboarding/kickoff.js` — onboarding Meeting binding ≠ Training Session |
| Calendar Event alone = delivery | FORBIDDEN / ATTENDANCE_TRUTH_RISK | Design: Calendar Event alone ≠ delivery |
| Exact retry Session create | NOT_FOUND | Wave 2 idempotency required |

**Implication:** Wave 2 Session + Meeting link; never fabricate delivery when Meeting/virtual unavailable.
