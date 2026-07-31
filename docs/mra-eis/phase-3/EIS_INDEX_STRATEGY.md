# EIS Index Strategy

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Indexes on: entitlement status; setting status; terminal(status,env); config(terminal,type,active); mappings; sequence; fiscalNumber; snapshot source; transmission(status,nextAttemptAt,oldest); attempts; validationURL; recon; created/accepted dates; (tenantId,businessId) everywhere.

No indexes on secret ciphertext needing plaintext search.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
