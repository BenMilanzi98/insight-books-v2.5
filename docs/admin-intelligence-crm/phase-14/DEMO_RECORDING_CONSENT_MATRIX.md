# Demo Recording Consent Matrix

| Signal | Today | Wave 4 rule | Class |
|--------|-------|-------------|-------|
| Recording request | NOT_FOUND | Explicit request; default OFF | NOT_FOUND |
| Consent UNKNOWN | Consent service READY | ≠ GRANTED; block recording start | CORRECT_AND_REUSABLE |
| Consent GRANTED | Consent service READY | Required before approve-to-record | CORRECT_AND_REUSABLE |
| Consent DENIED | Consent service READY | Deny path; no media | CORRECT_AND_REUSABLE |
| Approve / deny governance | NOT_FOUND | Admin governance workflow | NOT_FOUND |
| Media provider | Call recording NOT_AVAILABLE | Demo provider NOT_AVAILABLE | NOT_AVAILABLE |
| Fabricated recording file | Absent | FORBIDDEN | FORBIDDEN |
| RSVP ACCEPTED ⇒ recording consent | Meeting RSVP READY | FORBIDDEN equivalence | FORBIDDEN |
| Call recording status field | Call plane | WRONG_DOMAIN for Demo media | WRONG_DOMAIN / NOT_AVAILABLE |
