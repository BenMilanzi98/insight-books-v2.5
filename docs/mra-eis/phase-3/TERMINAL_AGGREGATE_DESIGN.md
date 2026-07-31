# Terminal Aggregate Design

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Properties

`id, tenantId(=businessId), branchId?, siteMappingId, environment, mraTerminalId, terminalPosition, terminalLabel, productId, productVersion, platformIdentity, status, activation*, tokenExpiresAt, credentialReference, config versions, lastContact*, blocked*, offlineCertified, offlineLimits, version, timestamps`

## Invariants

One tenant; compatible branch/site; env immutable while ACTIVE; prod needs prod entitlement; unique mraTerminalId/position in verified scope; ACTIVE ⇒ confirmed + usable creds; blocked cannot submit; offline requires cert; **no plaintext secrets in aggregate**.

## Conditional

SaaS `platformIdentity` / MAC strategy — **BLOCKED pending MRA Q-017–019**. Safe default: do not activate production until clarified; store opaque `platformIdentity` from approved strategy only.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
