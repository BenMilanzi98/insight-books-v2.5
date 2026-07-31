# Current Commercial Approval Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CRM commercial document approval engine | NOT_FOUND | APPROVAL_BYPASS_RISK if issue assumed without engine |
| ApprovalPolicy / Step / Decision | NOT_FOUND | — |
| SoD (requester ≠ protected approver) | NOT_FOUND | Pattern exists in Demo content SoD — WRONG_DOMAIN for quotes; EXTEND pattern |
| Opp close approval stub | FOUNDATION | `opportunities/close.js` optional CLOSE_APPROVAL_PENDING — not quote approval |
| Probability override approval | WRONG_DOMAIN | `probability.js` |
| Automation rules SoD | WRONG_DOMAIN | `automation/rules.js` |
| Demo content/env approvals | WRONG_DOMAIN | Demo plane |

**Implication:** Wave 2 commercial approval engine. Do not treat close/probability stubs as commercial approval.
