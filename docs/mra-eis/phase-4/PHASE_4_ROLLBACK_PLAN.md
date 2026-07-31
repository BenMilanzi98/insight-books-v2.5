# Rollback Plan

- Set platform status DISABLED (preserves rows)
- Or reverse migrate only if no entitlement history must be kept
- Do not delete audit/entitlement history in production rollback

---
*Phase 4 implementation. No MRA API calls from entitlement actions. No terminals activated. No posted Journals modified.*
