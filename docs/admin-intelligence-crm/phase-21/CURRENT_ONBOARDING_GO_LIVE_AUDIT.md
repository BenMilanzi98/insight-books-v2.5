# Current Onboarding Go-Live Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Go-live + approval models | CORRECT_AND_REUSABLE | CustomerOnboardingGoLive, CustomerOnboardingGoLiveApproval |
| Service | PARTIAL | `lib/admin/customerSuccess/onboarding/goLive.js` — UNKNOWN readiness blocks; Critical defects block |
| Stale approval alone insufficient | PARTIAL | `requireCurrentReadiness` in `goLive.js` re-checks via `isGoLiveReadinessAllowed` from `readiness/evaluate.js` |
| Decision SoD | PARTIAL | Internal/customer approvals — deepen |
| SUCCESSFUL → STABILISATION not COMPLETED | CORRECT_AND_REUSABLE | Status path in go-live / status services |
| Idempotency on execute | PARTIAL | Key required; conflict fail |

**Gaps:** G21-15…G21-16 → Wave 3.
