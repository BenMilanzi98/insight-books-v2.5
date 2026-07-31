# Transmission Aggregate Design

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

One transmission per snapshot; modes ONLINE | CERTIFIED_OFFLINE | TEST_SANDBOX.

Statuses include CREATED→QUEUED→CLAIMED→SENDING→SENT_AWAITING_RESULT→ACCEPTED_ONLINE|REJECTED|RETRY_SCHEDULED|UNKNOWN_OUTCOME|RECONCILING|…|DEAD_LETTER|BLOCKED|…

Invariants: ≤1 accepted per snapshot; unknown ⇒ reconcile before retry; blocked terminal cannot claim; checksum must match.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
