# Receipt QR Contract Decision

## Decision matrix

| Environment | Receipt contract | QR contract | Generation |
|---|---|---|---|
| MOCK / DEV | PROVISIONAL_SANDBOX_ONLY | PROVISIONAL_SANDBOX_ONLY | ALLOWED |
| Live SANDBOX | BLOCKED | BLOCKED | BLOCKED |
| PRODUCTION | BLOCKED | BLOCKED | BLOCKED |

## QR precedence (mock)
1. `validationUrl` (allowlisted HTTPS)
2. Raw `qrData` only if persisted and valid
3. Never invent; never use local app URLs

## Wording
- Prefer **Accepted by MRA** (not “MRA certified” / not “Validated by MRA” without contract)
- Sandbox banner mandatory
- Reprint: `REPRINT / COPY — NOT A NEW SALE`

## POS 58mm
**UNSUPPORTED** until mandatory fields + compliant QR fit are proven.

---
*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*
