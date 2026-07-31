# Deployment Plan

1. Set `MRA_EIS_MASTER_KEY_v1` (openssl rand -hex 32) per environment
2. `npx prisma migrate deploy`
3. `npx prisma generate` (stop Next if EPERM)
4. Verify `GET /api/admin/mra-eis/security/health` → masterKeyConfigured=true
5. Run Phase 6 vitest suite

---
*Phase 6 implementation. No MRA API calls. No terminal activation. No plaintext credentials persisted. No Sale/Journal/Stock mutations.*
