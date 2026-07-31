# Phase 4 — Platform Entitlement & Tenant Operational Controls

**Decision:** see PHASE_4_READINESS_DECISION.md

## Entry points
- System Admin UI: `/insightbooks/mra-eis`
- Tenant UI: `/settings/integrations/mra-eis`
- Module: `lib/mraEis/`
- Migration: `prisma/migrations/20260722220000_mra_eis_phase4_entitlement`

## Hierarchy
Platform → System Admin entitlement → Environment → Tenant participation → Business operational setting → Future runtime deps → Effective capability

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
