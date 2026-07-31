# Phase 3 — MRA EIS Target Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Decision

**READY_FOR_PHASE_4_WITH_BLOCKERS** — see [PHASE_3_READINESS_DECISION.md](./PHASE_3_READINESS_DECISION.md)

## One-line architecture

EIS is a **server-side compliance bounded context** that consumes `EligibleSaleFinalized`, creates an **immutable fiscal snapshot + Outbox event** in the same DB transaction as local Sale finalization/accounting, transmits asynchronously via a durable worker, and never posts Journals or mutates stock.

## Start here

1. [FINAL_PHASE_3_ARCHITECTURE_REPORT.md](./FINAL_PHASE_3_ARCHITECTURE_REPORT.md)
2. [PHASE_4_HANDOVER.md](./PHASE_4_HANDOVER.md)
3. [EIS_IMPLEMENTATION_WAVES.md](./EIS_IMPLEMENTATION_WAVES.md)
4. [adr/](./adr/)

## Hard blockers still open (do not ship fiscalization)

- Phase 1: message-hash, fiscal Base64 KAT, SaaS terminal identity, offline KAT, auth header, refund/return matrix
- Phase 2: POS/invoice request idempotency, outbox dispatcher, plaintext settings tokens, hasEISAccess bug, tenant-switch session, Float money

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
