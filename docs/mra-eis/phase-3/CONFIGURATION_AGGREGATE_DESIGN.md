# Configuration Aggregate Design

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Immutable snapshots: global / terminal / taxpayer (+ embedded taxrates, levies, offlineLimit).

Fields: terminalId, environment, type, mraVersion, effective/received, checksum, parsed data, raw ref, validation, active flag, supersededAt.

Never overwrite; one active per (terminal, type); snapshots on sales retain version refs.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
