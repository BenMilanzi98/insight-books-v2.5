# EIS Data Classification and Retention

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

| Data | Class | Encrypt | Retain |
|---|---|---|---|
| JWT/secretKey | SECRET | Yes | Until rotate/revoke + legal min |
| TAC / buyer auth | SHORT_LIVED_SECRET | Yes / transient | Minimal |
| TIN / buyer TIN | CONFIDENTIAL | At rest policy | Legal invoice retention |
| Snapshot / transmission | CONFIDENTIAL | Optional field | Legal + audit |
| validationURL / QR | INTERNAL | No | With invoice |

Legal periods: counsel (Phase 1). Never keep secrets only because invoices retained.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
