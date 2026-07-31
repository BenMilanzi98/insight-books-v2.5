# Secret Provider Architecture

`storeSecret` / `withSecret` / `revokeSecret` / `rotateCredential` / `getCredentialMetadata` / `rewrapSecretsBatch`.
Callback lease pattern — plaintext exists only inside `withSecret` callback.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
