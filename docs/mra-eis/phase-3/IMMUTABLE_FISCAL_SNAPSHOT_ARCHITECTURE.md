# Immutable Fiscal Snapshot Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Authoritative source for every transmission/retry.

Contains identity, dates, seller, buyer (frozen), lines (mapped codes + amounts), payments, totals, compliance versions, checksum, journalEntryId.

Rules: immutable once queued; no rebuild from mutable masters; no secrets; decimal-normalized amounts; checksum verified before send.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
