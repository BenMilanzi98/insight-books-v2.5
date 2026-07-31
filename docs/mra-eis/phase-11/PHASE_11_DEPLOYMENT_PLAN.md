# Deployment Plan

1. `npx prisma migrate deploy` (20260722280000)
2. Deploy app with Phase 11 routes/hooks
3. Confirm non-EIS tenants unchanged
4. Enable Business EIS only after mappings/terminals ready
5. Set `eisGoLiveAt` deliberately
6. Run missed-bridge dry-run

---
*Phase 11 implementation. Local sales eligibility + bridge only. No MRA Sale submission, fiscal number, QR, or “MRA validated” receipt. Bridge creates no Journal/Stock Movement. Customer payments are not Sales. Draft/Quote/Proforma excluded.*
