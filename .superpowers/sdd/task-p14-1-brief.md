### Task 1: Wave 1 — Request + Demo + schedule + participants + readiness spine

**Depends on:** Wave 0 CONDITIONAL GO; Phase 13 Meeting/Calendar/eligibility (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/demos/` — catalogue, numbering (`DMR-` / `DEMO-`), requests (create/qualify/reject/convert), demos (create/get/list/status), schedule (→ Meeting+Calendar), participants, readiness, model, index
- Extend authz/catalogue/index/foundations/nav for demos
- Prisma CrmDemoRequest*, CrmDemo*, CrmDemoParticipant*, CrmDemoStatusHistory*, readiness fields; SQL `scripts/sql/crm-demo-phase14-wave1.sql`
- APIs: `app/api/admin/crm/demo-requests/**`, `demos/**`
- UI: `/insightbooks/crm/demos` overview/my-demos/list/[id] stubs + requests hub
- Thin Opportunity/Lead Demo projection hooks if natural
- Tests: `test/systemAdmin.crm.demoWave1.test.js` (+ meeting/activity regression as needed)

**Do NOT:** Agenda/Script/Content versions, Environments, checklists/rehearsals, delivery/recording/feedback/outcome reports, Proposal create, git commit.

## Rules

- Demo ≠ Meeting; schedule **requires** one CrmMeeting + Calendar Event; times reconcile
- Convert request → Demo idempotent (stable key); exact retry returns existing
- Readiness: NOT_READY / PARTIALLY_READY / READY / BLOCKED; missing Meeting/presenter/Contact blocks READY_TO_DELIVER
- RSVP ≠ attendance (attendance Wave 4); no fabricated attendance
- No Proposal/Tenant provision; no auto Opportunity stage/probability/close-date
- Never alias MRA EIS sandbox as Demo Environment
- SQL + `hasCrm*Model` guards if Prisma EPERM

## Interfaces (produce)

- `allocateDemoRequestNumber`, `allocateDemoNumber`
- `createDemoRequest`, `qualifyDemoRequest`, `rejectDemoRequest`, `convertDemoRequest`
- `getDemo`, `listDemos`, `transitionDemoStatus`
- `scheduleDemo`, `evaluateDemoReadiness`
- Participant add/remove (roles: primary Contact, presenter, etc.)

## Acceptance

- [ ] DMR/DEMO numbers unique immutable
- [ ] Qualify/convert; convert idempotent
- [ ] Schedule creates/links Meeting+Calendar; end-before-start / timezone via P13 patterns
- [ ] Readiness blocks when required items missing
- [ ] Vitest PASS

## Report

`.superpowers/sdd/task-p14-1-report.md` — no commit.
