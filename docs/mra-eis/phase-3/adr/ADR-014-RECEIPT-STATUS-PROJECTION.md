# ADR-014: Receipt Status Projection

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Current QR is /verify.

## Decision

Separate receipt EIS projection; pending ≠ validated; QR from MRA URL when accepted.

## Alternatives considered

Always wait for MRA before any receipt — optional policy, not default.

## Consequences

Async UX complexity.

## Implementation phases

14

## Evidence

Phase 2 QR audit

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
