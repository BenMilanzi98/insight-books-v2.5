# Demo Reliability Matrix

| Signal | Status today | Honesty rule | Class |
|--------|--------------|--------------|-------|
| Demo counts | NOT_INSTRUMENTED | Never fabricate zeroes | NOT_FOUND |
| Demo Request (DMR) counts | NOT_INSTRUMENTED | Lead DEMO_REQUEST ≠ DMR until convert plane | FOUNDATION Lead only |
| Scheduled Demo vs Meeting reconcile | NOT_INSTRUMENTED | Fail → BLOCKED / UNAVAILABLE | NOT_FOUND |
| Attendance rates | NOT_INSTRUMENTED | RSVP ≠ attendance; no invent | NOT_FOUND |
| Recording completion rates | NOT_AVAILABLE | Provider boundary | NOT_AVAILABLE |
| Env READY health | NOT_INSTRUMENTED | Logical only; no fake cloud uptime | NOT_FOUND |
| Demo report metrics | NOT_INSTRUMENTED | EMPTY/UNAVAILABLE on gate fail | NOT_FOUND |
| Activity/Pipeline report patterns | READY (other planes) | Currency/honesty patterns reusable | CORRECT_AND_REUSABLE pattern |
| Scope stub bias | PARTIAL | My Work / lists may over-include | CARRY |

**Statuses:** AVAILABLE / PARTIAL_HISTORY / RECONCILIATION_FAILED / NOT_INSTRUMENTED / PERMISSION_RESTRICTED / UNAVAILABLE / NOT_CONNECTED / NOT_AVAILABLE.
