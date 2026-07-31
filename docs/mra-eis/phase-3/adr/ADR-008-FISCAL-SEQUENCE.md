# ADR-008: Fiscal Sequence Allocation

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Guide Base64/Julian vs legacy decimal.

## Decision

DB row-locked per-terminal daily sequence; algorithm versioned; blocked until KAT.

## Alternatives considered

In-memory counter — rejected.

## Consequences

Cannot ship numbering until Q-021.

## Implementation phases

12

## Evidence

Phase 1 FISCAL_NUMBERING; Phase 2 gap G2-007

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
