# Fiscal Numbering Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

## Algorithm

Per Phase 1 guide: Base64(TaxpayerID)-Base64(TerminalPosition)-Base64(JulianDate)-Base64(Count).

**Implementation BLOCKED until official examples reproduce (Q-021).** Interface + fixtures prepared; no production allocator shipping wrong format.

## Concurrency

`MraEisFiscalSequence(terminalId, businessDate)` row lock (`FOR UPDATE`) → increment → unique constraint on fiscalNumber → attach to snapshot.

No in-memory/cache-only counters. No reuse after allocation unless MRA explicitly allows (default: **never reuse**).

Crash after allocate: number remains reserved to snapshot; do not reassign.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
