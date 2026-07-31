# Support Performance Audit

| Concern | Guidance |
|---------|----------|
| Load all tickets in browser | Forbidden — server pagination |
| Recalc all SLA clocks on page load | Background/incremental |
| N+1 per ticket card | Batch; snapshots later |
| Public disk uploads | Replace with private storage for Support |

Wave 1 target: list page paged; detail loads conversation page-bounded.
