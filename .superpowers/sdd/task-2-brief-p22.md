### Task 2: Wave 2 — Curriculum / trainers / cohorts / participants / enrolment honesty

**Files:** Harden `curricula.js`, `materials.js`, `trainers.js`, `cohorts.js`, `participants.js`, `enrolment.js`, conflict helpers; test Wave 2

**Interfaces / hardens:**
- Active curriculum/template versions immutable once applied to Program
- Product modules ≠ Training modules (explicit refs)
- Trainer assignment requires qualification + conflict check (approved exception only)
- Participant identity dedupe; Customer/Tenant/Business/Branch scope
- Enrolment idempotent; capacity/prerequisite gates
- Invitation SENT ≠ DELIVERED ≠ REGISTERED; never invent delivery
- Restricted materials / answer keys never in Participant projections

- [ ] Write failing Vitest → implement → PASS Waves 1–2
- [ ] SDD review gate before Wave 3

---
