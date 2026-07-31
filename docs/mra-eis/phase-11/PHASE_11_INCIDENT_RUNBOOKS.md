# Incident Runbooks

| Incident | Action |
|---|---|
| Finalized sale missing bridge | `POST /api/mra-eis/sales-bridge` action=reconcile dryRun then approved repair |
| Stuck outbox | process-outbox action; check leases |
| Eligibility blocking POS | Use preflight; fix mappings/terminal/config |
| Suspected secret in payload | Alert; scrub; rotate credentials |

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
