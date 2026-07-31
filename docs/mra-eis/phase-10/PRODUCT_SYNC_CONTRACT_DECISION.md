# Product Sync Contract Decision

**Status:** `REQUIRES_MRA_CLARIFICATION` (Q-003).

Preferred assumption for MOCK: **POST** `/api/v1/utilities/get-terminal-site-products`.

Production calls: **blocked**. No automatic GET↔POST fallback.

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
