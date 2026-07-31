# Receipt QR Dependency Audit

| Component | Classification | Notes |
|---|---|---|
| `qrcode.react` (client) | LEGACY_READ_ONLY / UNSAFE for MRA | Not used for authoritative QR |
| `components/PrintableReceipt.js` local `/verify` QR | UNSAFE / MISLEADING_STATUS | Must not be MRA validation QR |
| Phase 13 `validationUrl` on response/projection | REUSE | Authoritative mock QR source |
| Phase 13 `qrDataPresent` flag | EXTEND | Raw qrData not persisted — missing payload blocks if URL absent |
| `jspdf` / `server-pdf-jspdf.js` | WRAP | New fiscal A4 renderer; do not mutate accounting invoice PDFs |
| Email system | EXTEND later | Controlled delivery hooks; not required for mock completion |
| Object storage | EXTEND | Local protected `storage/mra-eis` with overwrite protection |
| `MraEisReceiptProjection` | EXTEND | Receipt-ready statuses + QR checksum/asset refs |
| Fiscal snapshot / response evidence | REUSE | Immutable sources |

---
*Phase 14 implementation. Fiscal receipts and validation QR codes are created only from conclusively accepted MRA response evidence + immutable fiscal snapshots. HTTP 200 alone is not acceptance. No synthetic production QR. Validation URLs are allowlisted. Original artifacts are immutable. Reprints preserve fiscal number/MRA txn/QR source. No Journal/Stock Movement. No MRA Sales resubmit. Production/live-sandbox receipt generation BLOCKED until QR/receipt contracts are verified.*
