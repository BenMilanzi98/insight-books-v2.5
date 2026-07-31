# Phase 10 Gap Register

| Gap | Severity | Disposition |
|---|---|---|
| Product sync GET vs POST (Q-003) | HIGH | REQUIRES_MRA_CLARIFICATION / production blocked |
| Request hash for catalogue | HIGH | Fail-closed outside MOCK |
| Full vs Delta semantics | HIGH | UNKNOWN — no partial inactivation |
| Initial Inventory endpoint | HIGH | BLOCKED |
| Virtual Warehouse | HIGH | Carry from Phase 9 |
| Split payment | HIGH | Carry from Phase 9 |
| ProductVariant model | MEDIUM | Explicit per-SKU mapping |
| Bundle treatment | MEDIUM | REQUIRES_MRA_CLARIFICATION |
| Live sandbox sync | MEDIUM | NOT RUN |

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
