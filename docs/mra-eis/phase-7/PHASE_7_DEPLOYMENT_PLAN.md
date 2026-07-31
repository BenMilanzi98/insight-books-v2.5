# Phase 7 Deployment Plan

1. Set `MRA_EIS_MASTER_KEY_v1` (or test key only in non-prod)
2. Set `MRA_EIS_PRODUCT_ID` / `MRA_EIS_PRODUCT_VERSION` or seed `MraEisCertifiedProduct`
3. `npx prisma migrate deploy`
4. `npx prisma generate`
5. Deploy app; verify `/api/mra-eis/terminals/readiness`
6. Keep `MRA_EIS_ACTIVATION_MODE=MOCK` until sandbox authorized

---
*Phase 7 implementation. No Sale submission. No fiscal number/QR. No Journal/Stock mutations. TAC ephemeral. JWT/secret encrypted. ACTIVE only after confirmation.*
