# Phase 4 Handover

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Phase 4 scope

Platform EIS switch · System Admin entitlement grant/suspend/revoke · Tenant availability · Operational enable/pause · Environment authorization · Certification gating hooks · `EisEffectiveCapability` policy service · Permissions · Audit events · Admin/tenant APIs/UI · Queue-drain disable policy · Feature flags · Tests

## Approved for Phase 4

- Two-level entitlement + state machines
- Feature flag precedence
- Permission names (system.eis.* / eis.*)
- Effective capability computation
- No production transmission worker yet
- No terminal activation in Phase 4 unless separately approved

## Do not in Phase 4

Real TAC activation · fiscal submit · QR MRA validated · offline · speculative HMAC message-hash

## Preconditions preferred

Fix hasEISAccess + tenant-switch session signing (Phase 2 blockers) in same wave or immediately before.

## Acceptance

Entitlement changes audited; effectiveEnabled false without entitlement; tenant cannot self-entitle; suspend stops new fiscalization flags; history retained on disable.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
