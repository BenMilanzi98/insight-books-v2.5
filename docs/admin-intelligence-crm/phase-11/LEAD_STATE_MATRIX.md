# Lead State Matrix (planned)

Canonical statuses for Wave 1 state machine (greenfield — none exist today).

| Status | Meaning | Typical next | Forbidden transitions |
|--------|---------|--------------|----------------------|
| NEW | Captured / manually created | WORKING, DISQUALIFIED | Skip to WON/CONVERTED |
| WORKING | Owner actively engaging | QUALIFIED, NURTURE, DISQUALIFIED | Silent delete |
| NURTURE | Deferred working | WORKING, DISQUALIFIED | Direct CONVERTED |
| QUALIFIED | Passed qualification definition | READY_FOR_OPPORTUNITY, NURTURE, DISQUALIFIED | Score-only “qualify” |
| READY_FOR_OPPORTUNITY | Opportunity readiness true | (Phase 12+ Opportunity) / WORKING | Creating Opportunity in Phase 11 |
| DISQUALIFIED | Closed-lost / unfit | RECYCLE (controlled) | Auto-reopen without audit |
| RECYCLED | Returned to NEW/WORKING with reason | WORKING | Hide history |
| CONVERTED | Linked to Tenant/Customer post-win process | Terminal for Lead | Invent subscription from CRM |

**Rules:** Invalid transitions reject; all changes write status history; no AI auto-status.
**Today:** Entire matrix `NOT_FOUND` in code — implement Wave 1.
