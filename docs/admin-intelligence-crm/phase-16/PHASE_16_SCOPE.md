# Phase 16 Scope — Closed-Won Conversion

**Audited:** 2026-07-31  
**Upstream:** Phase 15 `READY_FOR_PHASE_16_WITH_BLOCKERS`  
**Design locks:** Early Closed Won in durable execution; Approach 1 durable saga; payment boundary + existing providers; Approach B waves

## In scope

1. Human-gated conversion request (`CVR-`) consuming Phase 15 Closed-Won handoff / acceptance evidence
2. Versioned conversion plan + dry run (preview only; no operational side effects)
3. Durable `CrmConversion` (`CVN-`) orchestrator with step executions, idempotency, resume, compensation
4. Early Closed Won via Phase 12 `closeOpportunityWon` / stage transition at durable start
5. Customer match create-or-link (no auto-merge on similar names)
6. Tenant / Business / Branch create-or-link via existing provisioners + isolation baseline
7. Contact link + initial User invitations (hash-only tokens)
8. Subscription + entitlements from accepted commercial snapshot (qty ≤ accepted)
9. Platform Billing Account / Schedule / Invoice (policy) + payment initiation boundary
10. Activation policy evaluation (Closed Won ≠ ACTIVE)
11. CS assignment + onboarding / training / migration / MRA EIS **handoffs** (≠ full execution)
12. Conversion hubs/reports/DQ/recon + honesty gates; Wave 4 weighted Pipeline UI unlock
13. Phase 17 handoff pack at exit

## Out of scope (explicit)

- Complete onboarding / training / data-migration / MRA EIS execution domains
- Production MRA EIS fiscal submission or credential fabrication
- Payment-gateway reimplementation; fabricated Payment / PAID
- Tenant opening balances / stock / journals / AR / revenue / tax from conversion
- Automatic Customer/Tenant merges
- AI provisioning / billing / onboarding plans
- Sales forecasting / commissions
- System CoA admin reintroduction
- Treating Tenant Quotation / rentals quotation as conversion commercial truth

## Carry blockers (document honesty)

| Blocker | Class |
|---------|-------|
| E-sign provider | NOT_CONFIGURED (Phase 15) — acceptance still valid with authority+checksum |
| `resolveCrmScope` stub `mode: 'all'` | CROSS_TENANT_RISK / CARRY |
| Weighted Pipeline UI | Dark until Wave 4 |
| Prisma EPERM on Windows | CARRY — SQL + `hasCrm*Model` |
| Rich conversion UI | Thin stubs OK early waves |
| Telephony / calendar sync / Lead ingest / Demo cloud | Orthogonal CARRY |

## Success exit (expected)

`READY_FOR_PHASE_17_WITH_BLOCKERS` when optional providers remain explicit typed unavailable.
