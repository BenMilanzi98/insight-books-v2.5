# Phase 9 Deployment Plan

1. Ensure Phases 5–8 migrations applied
2. `npx prisma migrate deploy` (Phase 9)
3. `npx prisma generate`
4. Deploy app
5. Verify mapping UI + readiness API in SANDBOX
6. Do not enable production fiscalization

---
*Phase 9 implementation. Suggestions never auto-activate. No Product/Service sync. No Sale submission. No fiscal numbers. No Journal/Stock mutations. Zero-rated ≠ exempt. VAT5 separate. Split payments fail-closed. Virtual Warehouse blocked pending MRA clarification.*
