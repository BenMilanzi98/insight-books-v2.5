# ADR-004: Accounting Independence

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

**Status:** Accepted (conditional where noted)

## Context

Avoid duplicate financial effects and outage coupling.

## Decision

Local posting succeeds without MRA; EIS never posts Journals or mutates stock.

## Alternatives considered

Two-phase commit with MRA — rejected.

## Consequences

Pending EIS after posted sale is normal.

## Implementation phases

11–13

## Evidence

Phase 2 posting engine audit

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
