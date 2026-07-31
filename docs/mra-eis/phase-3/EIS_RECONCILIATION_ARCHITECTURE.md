# EIS Reconciliation Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Types: eligibility, snapshot, transmission, last-online/offline, fiscal#, amounts, VAT, mappings, config, QR, queue, daily summary, terminal status.

Differences: LOCAL_SALE_WITHOUT_SNAPSHOT, SNAPSHOT_WITHOUT_TRANSMISSION, UNKNOWN_OUTCOME, DUPLICATE_*, MISMATCH_*, MRA_WITHOUT_LOCAL, OFFLINE_OVERDUE, SEQUENCE_GAP, …

**Never creates/modifies Journals.** Overrides need approval + audit.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
