# Incident Runbooks

| Incident | Action |
|---|---|
| Suspected stock change from sync | Impossible by design — audit metadata stockMutated=false; investigate other writers |
| Q-003 production attempt | Blocked; open clarification |
| Unknown inventory outcome | Do not blind-retry; Manual Review |

---
*Phase 10 implementation. External catalogue ≠ local master data. Suggestions never auto-activate. No Sale/fiscal number/QR. No Journal/Stock/price/tax auto-mutation. Product sync method Q-003 blocked for production. Initial Inventory upload blocked until verified. Cross-type mappings blocked by default.*
