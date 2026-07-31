# Phase 14 Gap Register

| ID | Gap | Severity | Status |
|---|---|---|---|
| G14-001 | Live sandbox QR payload / validation URL semantics unverified | HIGH | OPEN — generation blocked |
| G14-002 | Production receipt/QR contract unverified | CRITICAL | OPEN — generation blocked |
| G14-003 | Raw `qrData` not persisted in Phase 13 sanitized response | MEDIUM | Mitigated: validationUrl precedence for mock |
| G14-004 | Official MRA domain allowlist not confirmed | HIGH | Provisional hosts documented; production blocked |
| G14-005 | 58mm compliant fit unproven | MEDIUM | Marked unsupported |
| G14-006 | Full email delivery UX | LOW | API/download first; email template policy documented |
| G14-007 | Carry-forward G13 hash/success-code blockers | HIGH | Remain — affect live accept path |

---
*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*
