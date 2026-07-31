# Receipt and QR Lifecycle Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

States: LOCAL_FINALIZED · EIS_NOT_REQUIRED · EIS_PENDING · EIS_FISCALIZING · EIS_ACCEPTED_ONLINE · EIS_SIGNED_OFFLINE · EIS_REJECTED · EIS_UNKNOWN_OUTCOME · EIS_BLOCKED · EIS_MANUAL_REVIEW

Projection: local numbers, fiscal number, status, validationURL, QR checksum/asset, mode, terminal, TIN.

QR content = MRA validation URL (or certified offline structure). Replace InsightBooks `/verify` for fiscal receipts once accepted. Pending/rejected never "MRA Validated". Reprints immutable.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
