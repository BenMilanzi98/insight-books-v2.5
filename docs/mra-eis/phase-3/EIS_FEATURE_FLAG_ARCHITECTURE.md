# EIS Feature Flag Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Flags: platform, entitlement, operational, sandbox, production, activation, productSync, posFiscalization, invoiceFiscalization, onlineTransmit, offline, vat5, autoRetry, reconciliation, receiptQr.

Precedence: kill switch > suspension > entitlement > env > operational > terminal > feature flag. Flags ≠ permissions/cert bypass.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
