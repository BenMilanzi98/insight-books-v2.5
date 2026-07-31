# Current Win/Loss Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Win/loss reason codes | NOT_FOUND | — |
| Closed Won / Closed Lost states | NOT_FOUND | No Opportunity |
| Closed Won evidence requirements | NOT_FOUND | Design: evidence required |
| Closed Won → Tenant / Subscription / Invoice | FORBIDDEN | Must not provision |
| Lead CONVERTED / WON semantics as win/loss | WRONG_DOMAIN | Lead status ≠ deal close |
| Fabricated win rates | FORBIDDEN | Honesty gates |

**Implication:** Wave 3 win/loss with evidence on Closed Won; handoff payloads for proposal/conversion only — no provisioning.
