# Current Closed-Won Workflow Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `closeOpportunityWon` | CORRECT_AND_REUSABLE | `lib/admin/crm/opportunities/close.js` — requires winReason + decisionDate + evidence |
| Stage transition | CORRECT_AND_REUSABLE | Calls `transitionOpportunityStage` → `CLOSED_WON` with `closeServiceAuthorized: true` |
| Provision flags | CORRECT_AND_REUSABLE | Hardcodes provision flags false + `assertNoProvision` |
| Approval stub | FOUNDATION | `requireApproval` can return `CLOSE_APPROVAL_PENDING` without stage move |
| Close API route | CORRECT_AND_REUSABLE | `app/api/admin/crm/opportunities/[id]/close/route.js` echoes `provisionExecuted: false` |
| Acceptance → auto Closed Won | FORBIDDEN / CORRECT_AND_REUSABLE boundary | `acceptance.js` / readiness never mutate Opp stage |
| Phase 15 handoff → Closed Won | FORBIDDEN invent | `phase16Handoff.js` sets `closedWonAutoApplied: false` |
| Early Closed Won in conversion saga | NOT_FOUND | Design lock; orchestrator absent |
| Silent reopen after failed provision | NOT_APPLICABLE today | No conversion saga; Phase 12 `ALREADY_TERMINAL` blocks re-close |
| Non-transactional residual | FOUNDATION / PARTIAL_CONVERSION_RISK | Transition then separate close-field update (Phase 12 carry) |

**Implication:** Wave 1 must invoke Phase 12 close once at durable start; retain Closed Won on downstream failure; no silent reopen.
