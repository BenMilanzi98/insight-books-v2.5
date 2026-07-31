# ADR-020: No Undocumented Corrections

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Phase 1 incomplete correction matrix.

## Decision

Use only verified void/credit-debit APIs; inventing negative sales forbidden; unclear refunds stay MANUAL_REVIEW.

## Alternatives considered

Mirror local void to invent MRA payload — rejected.

## Consequences

Some flows blocked until MRA answers.

## Implementation phases

15+

## Evidence

Phase 1 corrections research

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
