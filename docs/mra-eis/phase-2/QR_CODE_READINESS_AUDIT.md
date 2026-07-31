# QR Code Readiness Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Library: qrcode.react (client SVG).
- Content today: `/verify/{localId}` — **not MRA**.
- Persist vs regenerate: mostly regenerate.
- Phase 3: encode MRA validationURL; checksum; reprint immutability.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
