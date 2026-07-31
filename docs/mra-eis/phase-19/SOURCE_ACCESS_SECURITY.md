# Source Access Security

- Prefer read-only DB roles and read-only transactions
- Never restore dumps over Production
- Never run untrusted SQL against Production
- Credential references only; JWT/TAC/private keys/BAC excluded from manifests
- API sanitizes credentialReference to `[REDACTED_REFERENCE]`

---
*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*
