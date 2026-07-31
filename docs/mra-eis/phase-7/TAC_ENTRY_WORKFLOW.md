# TAC Entry Workflow

- UI: password field; cleared after submit; never in URL
- API: POST body `terminalActivationCode` only
- Storage: ephemeral secret, TTL 15m, oneTime=false until confirmation destroy
- Audit: reference id + expiry only

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
