### Task 3: Wave 3 — Request honesty + onboarding handoff

**Files:**
- Harden: subscription/entitlement/tenant/user request steps; training/migration/MRA/integration/CS requirement handoffs; onboarding handoff create/send/supersede/checksum
- Ensure statuses never jump to ACTIVATED/PROVISIONED/PAID without provider result
- Test: `test/systemAdmin.crm.conversionPhase20Wave3.test.js`

**Interfaces:**
- Produces / hardens:
  - Request ≠ result honesty for all provision/activation paths
  - One active onboarding handoff; exact retry same; correction supersedes with history
  - Handoff pending provisioning labelled pending; does not create CS Onboarding Project
  - No secrets in handoff payloads; no GL/fiscal side effects
  - Partial provider failure → PARTIALLY_COMPLETED/BLOCKED; resume idempotent

- [ ] **Step 1: Write failing Vitest** — no fabricated ACTIVATED; handoff idempotent; supersession; no Project create; resume after fail
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Re-run Waves 1–3** — PASS
- [ ] SDD review gate before Wave 4

---
