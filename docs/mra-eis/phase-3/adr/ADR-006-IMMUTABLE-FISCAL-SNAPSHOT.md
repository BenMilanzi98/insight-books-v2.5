# ADR-006: Immutable Fiscal Snapshot

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Mutable masters would corrupt retries.

## Decision

Freeze all fiscal inputs at queue time; retries use snapshot only.

## Alternatives considered

Rebuild from Sale at send time — rejected.

## Consequences

Storage growth; edit locks after snapshot.

## Implementation phases

12–13

## Evidence

Phase 2 FUTURE_EIS_SNAPSHOT

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
