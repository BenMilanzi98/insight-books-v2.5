### Task 2: Wave 2 — Agenda / Script / Scenario / Content versioning

**Depends on:** Wave 1 CrmDemo (WORKING_TREE).

**Files:**
- `lib/admin/crm/demos/agendas.js`, `scripts.js`, `scenarios.js`, `content.js` (+ versioning/approve helpers)
- Pin agenda/script/scenario version ids on Demo when activated/applied
- SoD: author ≠ approver for material approve
- Customer-safe vs INTERNAL/RESTRICTED projections (restricted never on invitations/Customer APIs)
- Prisma + `scripts/sql/crm-demo-phase14-wave2.sql`
- APIs + thin UI under demos/[id]/agenda|script|content
- Tests: `test/systemAdmin.crm.demoWave2.test.js` (+ Wave 1 green)

**Do NOT:** Environments, delivery, recording, reports, Proposal create, git commit.

## Rules

- ACTIVE versions not directly editable; create new version to change
- Historical Demo retains pinned version ids
- No arbitrary executable template expressions
- en/ny foundations for script labels OK

## Acceptance

- [ ] Versioned Agenda/Script/Scenario/Content; ACTIVE immutable in place
- [ ] SoD approve where material
- [ ] Restricted Script projection protected
- [ ] Demo pins versions; Vitest PASS

## Report

`.superpowers/sdd/task-p14-2-report.md` — no commit.
