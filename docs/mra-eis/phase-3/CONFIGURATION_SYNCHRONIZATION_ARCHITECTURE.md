# Configuration Synchronization Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Triggers: activation, schedule, manual, `shouldDownloadLatestConfig`, unblock, version mismatch.

Lifecycle: REQUESTED→FETCHING→RECEIVED→VALIDATING→STORED→MAPPING_VALIDATION→ACTIVATED→COMPLETED · failure states.

Terminal-scoped lock; pause new transmissions while stale if policy requires.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
