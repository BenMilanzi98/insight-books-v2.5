# Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Message-hash unknown | HIGH | Fail-closed |
| Offline KAT missing | HIGH | Fail-closed |
| Activation sandbox pending | MED | productionEnabled=false |
| ENV master key ops | MED | Separate keys; backup policy |
| Legacy EIS plaintext token | HIGH | Quarantine; do not use for Phase 7 |

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
