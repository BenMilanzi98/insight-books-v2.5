# Authoritative Source Reload

`reloadAuthoritativeFiscalSource` reloads bridge, eligibility decision, Sale/Invoice, lines, payments, customer, terminal.

Outbox payload is references only — never trusted as fiscal content.

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
