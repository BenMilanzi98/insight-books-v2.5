# Rollback Plan

Keep ciphertext tables (additive). Disable credential store feature / pause EIS platform. Do not drop encrypted tables if any credentials stored. Master key retirement only after rewrap verification window.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
