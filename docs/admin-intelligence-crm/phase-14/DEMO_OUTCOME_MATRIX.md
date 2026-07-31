# Demo Outcome Matrix

| Outcome / action | Today | Allowed | Class |
|------------------|-------|---------|-------|
| Record Demo outcome | NOT_FOUND | Wave 4 | NOT_FOUND |
| Outcome completeness flag | NOT_FOUND | ≠ success | NOT_FOUND |
| Auto set Opportunity probability | Probability service READY | Never from Demo | FORBIDDEN |
| Auto stage transition | Stage SM READY | Never silent from Demo | FORBIDDEN |
| Auto Closed Won | Close READY | Never from Demo | FORBIDDEN |
| Emit Proposal handoff payload | proposalReadiness READY | Idempotent payload only | CORRECT_AND_REUSABLE |
| Create Proposal / Quotation | NOT this phase | Phase 15 | NOT_AVAILABLE / handoff-only |
| Emit Trial handoff payload | NOT_FOUND Demo side | Payload only; no Trial provision | NOT_FOUND → Wave 4 |
| Create Tenant / Subscription / Invoice | FORBIDDEN | Never | FORBIDDEN |
| Create Follow-Up | Follow-Up READY | Via Phase 13 | EXTEND |
| Feedback required for outcome | NOT_FOUND | Completeness optional ≠ block invent | NOT_FOUND |
