# EIS Logging and Redaction Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Safe fields: tenant/business/branch/terminal ids, source ids, snapshot/transmission/attempt ids, fiscalNumber, environment, endpoint, HTTP/MRA status, safe error, duration, correlation.

Redact Authorization, JWT, secret, TAC, buyer auth, raw payloads. Apply at client, workers, errors, monitoring.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
