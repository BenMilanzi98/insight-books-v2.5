# Final Phase 3 Architecture Report

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## 1. Executive summary

MraEis is a compliance bounded context. Eligible POS/Invoice finalizations emit `EligibleSaleFinalized`, create an immutable snapshot and Outbox event beside local accounting (no MRA I/O in that transaction), and transmit asynchronously. Accounting/stock remain single-effect. Credentials server-only. Offline gated. Historical sales not auto-submitted. Decision: **READY_FOR_PHASE_4_WITH_BLOCKERS**.

## 2–8. Inputs, principles, context, modules

See REQUIREMENT_TRACEABILITY_MATRIX, ARCHITECTURAL_PRINCIPLES, BOUNDED_CONTEXT, CONTEXT_MAP, TARGET_MODULE_STRUCTURE.

## 9–23. Entitlement through mappings

Two-level entitlement; env/cert gates; terminal aggregate; vault; immutable configs; site/product/tax/payment mappings versioned.

## 24–39. Eligibility, event, snapshot, numbering, transmission, outbox, workers

EligibleSaleFinalized; accounting independence; immutable snapshot; DB fiscal sequence (algorithm blocked until KAT); transmission SM; attempts; Outbox+dispatcher; per-terminal ordering; DB idempotency.

## 40–55. Client, crypto, online, recovery, receipt, B2B, VAT5, offline, recon, reports

Server client; crypto interfaces with blocks; online flow Option B pending UX; unknown→reconcile; receipt projection; B2B/VAT5; offline not currently feasible in browser; recon never touches Journals; EIS reports ≠ accounting books.

## 56–75. Permissions through migration/tests

See respective docs. ~26 entities; ≥20 constraints; 20 ADRs; waves 4–21.

## 76–89. Dependency graph, waves, ADRs, risks, blockers

See EIS_IMPLEMENTATION_*, adr/, PHASE_3_ARCHITECTURE_RISK_REGISTER, readiness decision.

## 90–99. Confirmations

- EIS creates no additional local accounting effect
- Sales remain locally authoritative
- Snapshots immutable for retries
- Fiscal numbering uses DB concurrency (when unlocked)
- Unknown outcomes reconcile before resubmit
- Credentials backend-only
- Tenant isolation required
- Pending/rejected ≠ MRA Validated
- Offline certification-gated
- No automatic historical submission

## 100–101. Decision & conclusion

**READY_FOR_PHASE_4_WITH_BLOCKERS.** Architecture is implementation-ready for entitlement and scaffolding; production fiscalization remains gated on listed blockers.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
