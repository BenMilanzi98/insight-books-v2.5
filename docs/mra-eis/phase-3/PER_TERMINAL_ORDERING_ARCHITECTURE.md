# Per Terminal Ordering Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Ordered: fiscal number alloc (in tx), transmission claim/send, offline upload, config refresh, block/unblock.

Partition key = terminalId. Cross-terminal parallel OK. No global tenant lock.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
