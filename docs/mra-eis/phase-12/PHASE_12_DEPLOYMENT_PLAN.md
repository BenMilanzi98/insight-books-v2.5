# Phase 12 Deployment Plan

1. Apply migration `20260722290000_mra_eis_phase12_fiscal_snapshot`
2. `npx prisma generate`
3. Deploy app
4. Enable synthetic sandbox via `MRA_EIS_ALLOW_SYNTHETIC_FISCAL_NUMBERS=1` (default)
5. Do **not** enable production allocation until MRA contract verified

---
*Phase 12 implementation. Immutable fiscal snapshots + atomic numbering only. No MRA Sale submission, QR, or “MRA validated” claim. Snapshot creates no Journal/Stock Movement. Production fiscal numbers blocked until MRA contract verified. Synthetic sandbox numbers are not MRA fiscal numbers.*
