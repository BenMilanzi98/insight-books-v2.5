# Atomic Activation

Single DB transaction activates required set + rebuilds `MraEisConfigurationPolicy`. Failure preserves prior active set.

---
*Phase 8 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock/local-tax mutations. Snapshots immutable. Activation atomic. Offline remains disabled.*
