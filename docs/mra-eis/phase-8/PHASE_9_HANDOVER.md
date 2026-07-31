# Phase 9 Handover — Mapping

## Inputs ready from Phase 8
- Active GLOBAL/TERMINAL/TAXPAYER snapshots
- `MraEisExternalTaxDefinition` / `MraEisExternalLevyDefinition`
- Offline thresholds + receipt policy on `MraEisConfigurationPolicy`
- Mapping-revalidation Outbox events
- Configuration Health + pause contract
- Site/Tax/Levy/Payment mapping models (Phase 5)
- Effective capability + terminal health

## Phase 9 owns
Branch/site mapping, tax/levy/payment mapping, suggestions, approval, completeness, effective dates, conflict UI, production readiness gating, resolution for Sales.

## Blockers carried
- Q-010/Q-011 hash
- Live sandbox config verification
- Production sync gates
- Payment-method / split-payment ambiguities from Phase 1

## Acceptance for Phase 9 start
Active mock terminal with activated configuration set and external tax/levy projections available for mapping without re-fetching activation.

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
