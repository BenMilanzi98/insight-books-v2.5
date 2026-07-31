# EIS Reporting Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Registers for accepted/pending/rejected/unknown/offline, fiscal numbers, terminals, configs, mappings, VAT5, daily recon, queue health, certification readiness, retries/DLQ.

Tenant/business scoped; no secrets; link to Sale+Journal+Snapshot+Transmission. Reports do **not** redefine Revenue.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
