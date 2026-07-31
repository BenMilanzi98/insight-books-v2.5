# Current Security And Crypto Audit

## Reuse
- `lib/encryption.js` AES-CBC legacy (not Phase 6 final)
- SecV2 `redactForAudit` / webhook HMAC / API keys
- Phase 5 `MraEisCredentialReference.vaultReference`

## Critical findings (pre-Phase 6)
- Committed `.env` / docker-compose secrets (ops hygiene)
- Legacy `EISConfiguration.settings.token` plaintext JWT path
- CBC without auth tag

## Phase 6 response
- New ENV_ENVELOPE AES-GCM path for MRA EIS credentials
- Legacy EIS path gated/quarantined (not migrated wholesale in this phase)
- Master key separate from ENCRYPTION_KEY

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
