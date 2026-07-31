# Terminal Creation Implementation

`createTerminalForOnboarding` validates readiness, ensures identity, creates draft, sets TAC_REQUIRED or READINESS_INCOMPLETE.

Idempotency: same label/env/business returns existing when Idempotency-Key / label match.

No MRA call on create.

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
