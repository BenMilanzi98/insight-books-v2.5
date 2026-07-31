# Authoritative Finalization Integration

Preflight before `POST /api/sales` / invoice issue. Bridge after local accounting commit via `finalizationIntegration.js`. Prefer atomicity; recovery + reconcile when post-commit fails.

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
