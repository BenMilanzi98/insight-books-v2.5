# Assignment Matrix (planned)

| Action | Actor | Permission (planned) | History | Class today |
|--------|-------|----------------------|---------|-------------|
| Claim Lead | Sales user | `crm.leads.manage` / assign | Yes | NOT_FOUND |
| Assign to user | Team lead | assign | Yes | NOT_FOUND |
| Assign to team | Team lead | assign | Yes | NOT_FOUND |
| Territory auto-suggest | System | rules engine | Suggest only | NOT_FOUND |
| Silent reassignment loop | — | Forbidden | — | N/A |
| Support queue assign | Support | `support.assignTickets` | Ticket history | WRONG_DOMAIN |
| CS case assign | CS | CS manage | Case history | WRONG_DOMAIN |

**Rule:** Every ownership change writes assignment history; no silent loops.
