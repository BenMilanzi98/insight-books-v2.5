# Incident Runbooks

**Suspected key compromise:** revoke affected credentials, rotate master key, rewrap batch, audit access denials.
**Integrity failure:** pause EIS, preserve ciphertext, open manual review, do not auto-decrypt.
**Leakage in logs:** rotate exposed credential, scrub logs, alert.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
