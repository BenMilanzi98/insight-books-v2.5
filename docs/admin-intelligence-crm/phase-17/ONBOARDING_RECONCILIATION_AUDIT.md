# Onboarding Reconciliation Audit

**Audited:** 2026-07-31

| Reconciliation pair | Current | Class |
|---------------------|---------|-------|
| Phase 16 ONBOARDING handoff ↔ Request | No consume | UNRECONCILED — Wave 1 |
| Request ↔ Project (1:1) | Absent | NOT_FOUND — Wave 1 |
| Project ↔ templateVersion definition | Absent | NOT_FOUND — Wave 2 |
| Project scope ↔ Subscription/entitlements | Conversion snapshot exists; Project absent | REUSE_WITH_RECONCILIATION — Wave 2/3 |
| Kick-off ↔ CrmMeeting | Meetings exist; kickoff absent | UNRECONCILED — Wave 2 |
| Migration handoff ↔ migration coordination | Handoff only | UNRECONCILED — Wave 3 |
| Training handoff ↔ training coordination | Handoff only | UNRECONCILED — Wave 3 |
| MRA handoff ↔ MRA readiness | Handoff only | UNRECONCILED — Wave 3 |
| Go-live ↔ stabilisation ↔ handover ↔ certificate | Absent | NOT_FOUND — Wave 3 |
| Phase 8 CsOnboardingRecord ↔ Project | No link column | UNRECONCILED — Wave 4 |
| Conversion completion cert ↔ onboarding complete | Must stay distinct | CORRECT_AND_REUSABLE / WRONG_DOMAIN if equated |
| Conversion recon pattern | `conversions/reconciliation.js` | CORRECT_AND_REUSABLE pattern |

**Disposition:** Wave 4 `reconciliation.js` + lineage; interim Waves assert pair invariants as entities land.
