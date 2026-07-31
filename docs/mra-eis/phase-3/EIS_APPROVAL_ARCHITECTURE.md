# EIS Approval Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Use SecV2 approvals for: production activation, terminal activate, credential reset, offline enable, mapping overrides, historical submit, permanent-reject retry, recon override, disable with queue, terminal replace, cert change.

Checksum + no self-approval + expiry + reason. Ordinary technical retries: no approval.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
