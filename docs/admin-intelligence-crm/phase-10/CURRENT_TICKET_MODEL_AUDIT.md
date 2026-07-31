# Current Ticket Model Audit

| Model | Class | Notes |
|-------|-------|-------|
| SupportTicket | NOT_FOUND | — |
| SupportMessage / Note | NOT_FOUND | — |
| CsCase | FORBIDDEN as ticket | Status OPEN/IN_PROGRESS/RESOLVED/CLOSED |
| PerformanceFeedback | WRONG_DOMAIN | HR |
| Contact demo email | FORBIDDEN as ticket | No persistence as ticket |

**Disposition:** Wave 1 introduces SupportTicket + StatusHistory + numbering.
