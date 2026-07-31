# Phase 17 Scope — Customer Onboarding

**Audited:** 2026-07-31  
**Upstream:** Phase 16 `READY_FOR_PHASE_17_WITH_BLOCKERS`  
**Design locks:** Dual-entity Request/Project; auto Request from ONBOARDING handoff; Phase 13 kick-off; admin attestation evidence; Approach B waves

## In scope

1. Consume Phase 16 `CrmConversionDomainHandoff` type `ONBOARDING` → idempotent `CustomerOnboardingRequest` (`ONR-`)
2. Human validate/accept/reject Request; convert to `CustomerOnboardingProject` (`ONB-`) with pinned `templateVersionId`
3. Versioned onboarding templates + one-shot materialisation of workstreams/milestones/tasks/checklists
4. Kick-off via Phase 13 Meetings (RSVP ≠ attendance); stakeholders; requirements/scope; Change Requests on mismatch
5. Customer Task evidence by admin attestation; portal typed `CUSTOMER_PORTAL_NOT_CONFIGURED`
6. Tenant / Business / Branch / User / product-config readiness evaluation (coordinate, do not silently repair identity)
7. Accounting setup **coordination boundary only** — no journals/OB/stock/AR/AP/tax from onboarding
8. Migration / MRA EIS / Training **coordination** consuming distinct Phase 16 handoffs (≠ full engines)
9. Testing / defects tracking; go-live readiness/approval/execution → stabilisation → handover → checksummed completion
10. Onboarding health/progress (deterministic, no ML); reliability gate; DQ/recon/lineage; reports/exports
11. Reconcile Phase 8 `CsOnboardingRecord` via `onboardingProjectId` link (Wave 4)
12. Phase 18 input pack at exit

## Out of scope (explicit)

- Complete Customer Training Management (Phase 18)
- Trainer capacity, training certificates/assessments as Training-domain completion
- Complete data-migration engine reimplementation
- Complete accounting setup wizard reimplementation; direct accounting postings
- Complete MRA EIS fiscal implementation / unauthorised Production submission / credential store in onboarding
- Complete Support or Subscription billing reimplementation
- Automatic commercial price changes / subscription amendments / Customer or Tenant merges
- AI-generated plans, decisions, go-live approvals, ML health scores
- Customer evidence portal (typed `CUSTOMER_PORTAL_NOT_CONFIGURED`)
- Fabricating onboarding/training/migration/MRA/go-live/completion from handoff emission alone
- System `/insightbooks/chart-of-accounts` reintroduction

## Carry blockers (document honesty)

| Blocker | Class |
|---------|-------|
| Customer portal | NOT_AVAILABLE / `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Full Training execution domain | NOT_AVAILABLE — Phase 18 |
| Full migration engine | NOT_AVAILABLE — coordinate only |
| Payment provider | NOT_CONFIGURED (Phase 16 carry) |
| E-sign provider | NOT_CONFIGURED (Phase 16 carry) |
| `resolveCrmScope` stub `mode: 'all'` | CROSS_TENANT_RISK / CARRY — `lib/admin/crm/authz.js` |
| Prisma EPERM on Windows | CARRY — SQL + `hasCustomerOnboarding*Model` / `hasCs*` guards |
| Rich onboarding UI hubs | Thin stubs OK early waves |
| Telephony / calendar sync / Lead ingest / Demo cloud | Orthogonal CARRY |

## Success exit (expected)

`READY_FOR_PHASE_18_WITH_BLOCKERS` when optional portal / migration engine / Training execution / providers remain explicit typed unavailable.
