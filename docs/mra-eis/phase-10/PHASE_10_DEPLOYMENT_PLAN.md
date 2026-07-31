# Deployment Plan

1. Deploy app with Phase 10 modules
2. Keep MRA_EIS_ACTIVATION_MODE=MOCK until Q-003 cleared
3. Do not set MRA_EIS_INITIAL_INVENTORY_SUBMIT=true
4. Verify catalogue UI + readiness APIs

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
