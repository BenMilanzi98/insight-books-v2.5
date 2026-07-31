# Phase 7 Incident Runbooks

## Unknown activation outcome
1. Do not retry
2. Open Manual Review
3. Check attempt evidence (sanitized)
4. Contact MRA support if no recovery endpoint

## Partial credential storage
1. Confirm CREDENTIAL_STORAGE_FAILED
2. Ensure partial JWT revoked
3. Manual recovery — do not confirm

## Cross-tenant access
1. Expect 403/permission error
2. Audit event
3. Investigate actor

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
