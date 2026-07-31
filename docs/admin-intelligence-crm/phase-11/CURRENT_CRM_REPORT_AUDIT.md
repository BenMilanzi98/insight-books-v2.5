# Current CRM Report Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CRM reports UI (`/insightbooks/crm/reports`) | NOT_FOUND | No crm app tree |
| Lead volume / conversion dashboards | NOT_FOUND | — |
| Scheduled CRM reports | NOT_FOUND | — |
| Metric envelopes for CRM | NOT_FOUND | AdminShell envelopes exist generally; no CRM series |
| Support / CS / Product reports as CRM | WRONG_DOMAIN | Different domains |
| Zero Lead count when plane missing | FORBIDDEN if shown | Reliability: gate NOT_INSTRUMENTED — never false zero |

**Implication:** Wave 4 report stubs + honesty gates. Expected exit keeps full reporting as blocker.
