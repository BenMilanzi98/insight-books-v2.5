# Catalogue Sync State Machine

QUEUED → CLAIMED → REQUEST_MAPPING → FETCHING → STORING_CATALOGUE → COMPLETED / COMPLETED_NO_CHANGES / COMPLETED_WITH_WARNINGS / FAILED / UNKNOWN_OUTCOME / MANUAL_REVIEW.

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
