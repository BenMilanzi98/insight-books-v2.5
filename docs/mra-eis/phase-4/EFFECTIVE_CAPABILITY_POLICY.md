# Effective Capability Policy

`evaluateMraEisCapability` (pure) + `evaluateTenantEisCapability` (DB-backed).
All later phases must call this before fiscal operations.

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
