# CI/CD Secret Security

Never commit `MRA_EIS_MASTER_KEY*`. Tests use `MRA_EIS_ALLOW_TEST_MASTER_KEY=1`. Mask logs. No secrets in Docker layers.

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
