# SLA Matrix (planned)

| Clock | Starts | Stops | Pause | Live today |
|-------|--------|-------|-------|------------|
| FIRST_RESPONSE | Eligible ticket create | First valid **public human** reply | Per policy | NOT_FOUND |
| NEXT_RESPONSE | Customer eligible reply | Public agent reply | Per policy | NOT_FOUND |
| RESOLUTION | Create or assign (policy) | Verified resolution | Waiting statuses if policy | NOT_FOUND |
| CUSTOMER_WAIT / INTERNAL_WAIT | Enter waiting status | Leave waiting | — | NOT_FOUND |

**Ack emails / system events do not stop FIRST_RESPONSE** unless policy version explicitly says so.

Calendars: timezone + working hours + holidays; historical results pin policy+calendar versions.
