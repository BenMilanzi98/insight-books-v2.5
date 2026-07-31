# ADR-009: Per-Terminal Ordering

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Last-online/offline and sequence semantics are terminal-scoped.

## Decision

Partition transmission/config work by terminalId; parallel across terminals.

## Alternatives considered

Global tenant lock — rejected.

## Consequences

Fairness controls needed.

## Implementation phases

13,15

## Evidence

Phase 1 + Phase 2 concurrency

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
