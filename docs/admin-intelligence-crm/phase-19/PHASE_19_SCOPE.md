# Phase 19 Scope — Customer Adoption

**Audited:** 2026-07-31  
**Upstream:** Phase 18 `READY_FOR_PHASE_19_WITH_BLOCKERS`  
**Design locks:** Dual-entity Request/Plan; hybrid entry (Training Program `COMPLETED` auto + manual + onboarding handover attach); Phase 9 read-only evidence; Phase 8 interventions linked not rebuilt; Approach B waves

## In scope

1. Consume Phase 18 `CustomerTrainingProgram` aggregate `COMPLETED` → idempotent `CustomerAdoptionRequest` (`ADR-`)
2. Attach Phase 17 onboarding handover refs (never invent Training COMPLETED; never auto-complete Adoption Plan)
3. Manual / CS / support / signal-sourced Requests with human validate/accept/reject
4. Convert accepted Request → `CustomerAdoptionPlan` (`ADP-`) with pinned `planTemplateVersionId`
5. Role-based milestones with evidence modes PRODUCT_ANALYTICS / TRAINING_CERT / CS_ATTESTATION / MIXED
6. Value / business outcome records with Phase 9 snapshots + lineage (gate fail → UNAVAILABLE / null)
7. Plan completion evaluation (critical milestones MET|WAIVED + value review + no blocking Critical DQ)
8. Champion assignments (verified contact; no fabricated engagement scores)
9. Dormancy recovery cases sourced from Phase 9 inactive-class signals; RECOVERED requires evidence
10. Link Phase 8 Interventions / Playbook executions (store id + attestation; do not re-implement engine)
11. Expansion / renewal handoff records (HANDED_OFF / ACKNOWLEDGED) — handoff ≠ execute billing/entitlement
12. Adoption health/metrics with reliability gate; DQ/recon/lineage; reports/exports/search
13. Reconcile Phase 8 Success Plan / Playbook / Intervention via optional `adoptionPlanId` (or foreign ids) — UNKNOWN if unresolved
14. Phase 20 input pack at exit

## Out of scope (explicit)

- Replacing Phase 8 CS case / playbook / intervention engines
- Replacing Phase 9 product-analytics warehouse / Intelligence product-analytics home UI
- Executing subscription renewals, proration, invoicing, or entitlement grants from Adoption
- Full customer-facing adoption LMS / self-serve portal (typed unavailable if referenced)
- Advanced ML churn scoring / predictive health as Adoption truth
- AI-fabricated usage, milestones MET, Plan COMPLETED, dormancy RECOVERED, or expansion execute
- Tenant accounting postings; System CoA reintroduction
- Phase 18 Training Program / LMS reimplementation
- Phase 17 Onboarding Project spine reimplementation
- Clearing Phase 18 carry blockers silently (virtual provider, recording, rich banks, training portal, payment/e-sign)

## Carry blockers (document honesty)

| Blocker | Class |
|---------|-------|
| Virtual meeting provider / recording | NOT_AVAILABLE / `VIRTUAL_PROVIDER_NOT_CONFIGURED` (Phase 18) |
| Rich SCORM / question-bank LMS authoring | NOT_AVAILABLE (Phase 18) |
| Customer training / evidence portal | NOT_AVAILABLE / `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Payment / e-sign providers | NOT_CONFIGURED (Phase 16→18 carry) |
| `resolveCrmScope` stub `mode: 'all'` | CROSS_TENANT_RISK / CARRY — `lib/admin/crm/authz.js` |
| Prisma EPERM on Windows | CARRY — SQL + `hasCustomerAdoption*Model` / `hasCs*` guards |
| Rich Adoption UI hubs | Thin stubs OK early waves |
| Advanced ML churn / portal self-serve | NOT_AVAILABLE (Phase 20 foreshadow) |
| Renewals billing execute-after-ACK | NOT_AVAILABLE (Phase 20) |

## Success exit (expected)

`READY_FOR_PHASE_20_WITH_BLOCKERS` when Phase 18 carry blockers + thin UI / advanced ML / portal self-serve / deep renewals execute remain explicit typed unavailable.
