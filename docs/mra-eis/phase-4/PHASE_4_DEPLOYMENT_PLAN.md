# Deployment Plan

1. Deploy code
2. `npx prisma migrate deploy`
3. Enable platform status ENABLED when ready
4. Grant sandbox entitlements deliberately
5. Keep productionGloballyAllowed false until certification evidence exists

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
