# Backup And Restore Security

Ciphertext may appear in DB dumps — encrypt backups at rest. Production master keys must not be loaded in development restores. Restore tests: matching env decrypts; mismatched master fails.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
