# Credential Reference Model

Table: `MraEisCredentialReference`
- `vaultReference` only (Phase 6 vault)
- No jwt/secretKey/activationCode columns
- Types: TERMINAL_JWT, TERMINAL_SECRET, ACTIVATION_CODE_EPHEMERAL, …
- Rotation via new row + `replacedByReferenceId`
- Partial unique: one ACTIVE per terminal+type (SQL)

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
