# Current Onboarding Handoff Consumption Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Emit checksum | CORRECT_AND_REUSABLE | `computeOnboardingHandoffChecksum` in `lib/admin/crm/conversions/handoffShared.js` (emit side) |
| Consume → Request | PARTIAL | `consumeOnboardingHandoff` in `lib/admin/customerSuccess/onboarding/handoffConsume.js` — idempotent ONR create |
| Forces onboardingCompleted false | CORRECT_AND_REUSABLE | Payload strip in consume |
| Ack execution IN_PROGRESS only | CORRECT_AND_REUSABLE | `acknowledgeOnboardingHandoffInProgress` in `handoffConsume.js` forbids COMPLETED |
| acceptOnboardingHandoff API | NOT_FOUND | Design requires accept with checksum + UNKNOWN≠VALID |
| Checksum validate on consume | GAP | Consume does not call checksum compare before create |
| Handoff ≠ Project | CORRECT_AND_REUSABLE | Consume never creates ONB Project |
| Supersession / correction on accept | PARTIAL | Upstream one-active; accept-path history deepen Wave 1 |

**Gaps:** G21-01…G21-03 → Wave 1.
