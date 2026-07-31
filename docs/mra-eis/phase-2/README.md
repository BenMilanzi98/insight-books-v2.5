# Phase 2 — InsightBooks Architecture Audit for MRA EIS

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

## Decision

**READY_FOR_PHASE_3_WITH_BLOCKERS** — see [PHASE_2_READINESS_DECISION.md](./PHASE_2_READINESS_DECISION.md)

## Inputs

Phase 1 pack: `docs/mra-eis/phase-1/`

## Key architectural facts

1. **Tenant = Business** (no separate Business model); `businessId` aliases `tenantId` in Accounting V2.
2. POS and Invoice finalize accounting **inside** local `$transaction`; legacy EIS submit is **post-commit best-effort**.
3. Accounting V2 Outbox **writes** but has **no production dispatcher**.
4. QR today points to InsightBooks `/verify/{id}`, not MRA validation URL.
5. Existing EIS client is **REUSABLE_WITH_CHANGES / UNSAFE** for production fiscalization (credential model, invoice numbering, post-commit submit).

## Document index

See filenames in this directory. Start with FINAL_PHASE_2_REPORT.md and PHASE_3_HANDOVER.md.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
