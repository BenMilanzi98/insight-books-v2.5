# Email State Matrix

| State | Today | Wave 2 target | Notes |
|-------|-------|---------------|-------|
| DRAFT | NOT_FOUND | YES | |
| ELIGIBILITY_CHECKED | Gate exists (no persist on email) | Persist on send-request | |
| SEND_REQUESTED | NOT_FOUND | YES idempotent | |
| ACCEPTED_BY_PROVIDER | NOT_FOUND | Map from SMTP accept | ≠ delivered |
| SENT | NOT_FOUND | YES | |
| FAILED | NOT_FOUND | YES | |
| DELIVERED | NOT_FOUND | Only with evidence | Never invent |
| OPENED / REPLIED | NOT_FOUND | FORBIDDEN invent | No pixels / reply sync |
| Email → Lead ingest | NOT_AVAILABLE | Stay NOT_AVAILABLE | foundations.js |

