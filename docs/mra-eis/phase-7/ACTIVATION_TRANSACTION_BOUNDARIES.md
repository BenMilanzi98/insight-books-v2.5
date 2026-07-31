# Activation Transaction Boundaries

Tx A: claim + attempt + ACTIVATION_IN_PROGRESS.  
External MRA call (no open DB tx).  
Tx B: persist attempt, credentials, config, CONFIRMATION_PENDING.

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
