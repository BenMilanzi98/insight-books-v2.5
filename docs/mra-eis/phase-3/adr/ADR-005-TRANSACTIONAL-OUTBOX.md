# ADR-005: Transactional Outbox

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

AcctV2Outbox undrained; post-commit submit unsafe.

## Decision

Persist EIS Outbox events atomically with snapshot; durable dispatcher required.

## Alternatives considered

Fire-and-forget after commit — rejected for production.

## Consequences

Need worker infra.

## Implementation phases

5,13

## Evidence

Phase 2 TRANSACTIONAL_OUTBOX_AUDIT

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
