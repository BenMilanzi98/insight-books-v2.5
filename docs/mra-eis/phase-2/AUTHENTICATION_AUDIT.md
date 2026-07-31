# Authentication Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

Login + HMAC session v2; legacy unsigned possible. Tenant switch drops signature (**BLOCKER**).

Step-up needed for: entitlement, TAC entry, activation, prod mode, offline enable, mapping changes, credential rotate.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
