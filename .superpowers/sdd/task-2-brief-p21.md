### Task 2: Wave 2 — Readiness honesty + accounting boundary

**Files:** Harden provisioning/subscription/entitlement/user/access/config/migration readiness modules; accounting boundary helpers; test Wave 2

**Interfaces / hardens:**
- Request ≠ READY/ACTIVE/PROVISIONED without provider result
- Invitation sent ≠ ACCESS_VALID
- No fabricated Tenant/User IDs
- Migration coordinate/reconcile only; no unsafe browser import
- Accounting: governed services only; no balance edit / fake journal / CoA admin
- Portfolio fail-closed on readiness writes-by-id

- [ ] Write failing Vitest → implement → PASS Waves 1–2
- [ ] SDD review gate before Wave 3

---
