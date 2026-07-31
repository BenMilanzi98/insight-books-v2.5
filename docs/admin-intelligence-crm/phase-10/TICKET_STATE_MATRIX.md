# Ticket State Matrix (planned)

| Status | Typical from | Notes |
|--------|--------------|-------|
| NEW | create | |
| ACKNOWLEDGED | NEW | System/human ack |
| TRIAGE | ACKNOWLEDGED | |
| ASSIGNED | TRIAGE | |
| IN_PROGRESS | ASSIGNED | |
| WAITING_FOR_CUSTOMER | IN_PROGRESS | Pause SLA if policy |
| WAITING_FOR_INTERNAL_TEAM | IN_PROGRESS | |
| WAITING_FOR_VENDOR | IN_PROGRESS | |
| RESOLVED | IN_PROGRESS | Requires resolution category |
| CUSTOMER_CONFIRMED | RESOLVED | Needs customer evidence (portal later) |
| CLOSED | RESOLVED/CONFIRMED | |
| REOPENED | RESOLVED/CLOSED | |
| DUPLICATE / MERGED / CANCELLED / SPAM | various | Evidence preserved |

Invalid transitions fail visibly. Closed immutable except approved reopen.
