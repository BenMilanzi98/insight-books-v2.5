# Impact–Urgency Priority Matrix (planned v1)

Keep IMPACT, URGENCY, PRIORITY, SEVERITY distinct.

| Impact \ Urgency | IMMEDIATE | HIGH | NORMAL | LOW |
|------------------|-----------|------|--------|-----|
| PLATFORM_WIDE / MULTIPLE_TENANTS | P1 | P1 | P2 | P2 |
| ENTIRE_TENANT / MULTIPLE_BUSINESSES | P1 | P2 | P2 | P3 |
| MULTIPLE_USERS / MULTIPLE_BRANCHES | P2 | P2 | P3 | P3 |
| SINGLE_USER / SINGLE_BRANCH | P2 | P3 | P3 | P4 |
| UNKNOWN | P3 | P3 | P4 | P5 |

Manual priority override requires permission + reason + audit. Customers cannot set PLATFORM_WIDE severity without internal validation.
