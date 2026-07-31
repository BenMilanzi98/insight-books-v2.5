### Task 2: Wave 2 — Conversion saga idempotency, snapshot immutability, customer/contact duplicates

**Files:**
- Harden: conversion create/orchestrator/steps, commercial snapshot lock/checksum, customer duplicate review, contact convert/link
- Test: `test/systemAdmin.crm.conversionPhase20Wave2.test.js`

**Interfaces:**
- Produces / hardens:
  - Exact retry → same Conversion; conflicting idempotency → fail
  - Snapshot immutable after lock; silent Proposal edit does not mutate snapshot
  - EXACT_MATCH Customer blocks auto-create; LINK_EXISTING path; no auto-merge
  - Contact duplicate link vs create; consent preserved; cross-Customer denied
  - Optimistic concurrency / step resume without duplicate downstream creates

- [ ] **Step 1: Write failing Vitest** covering above
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---
