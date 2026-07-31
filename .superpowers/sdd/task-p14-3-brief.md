### Task 3: Wave 3 — Logical Environment + data packs + checklist/rehearsal

**Depends on:** Waves 1–2 CrmDemo + content versions (WORKING_TREE).

**Files:**
- `lib/admin/crm/demos/environments.js` — DENV numbering; request/approve; logical provisioner; health; reset; expiry; deprovision; idempotency keys; DEMO banner flag; no Production connections
- `lib/admin/crm/demos/dataPacks.js` — versioned packs; checksum; Production-data/credential detection reject
- `lib/admin/crm/demos/checklists.js`, `rehearsals.js` — versioned checklist execution; rehearsal outcomes/issues; Critical issues block readiness
- Wire readiness to require env READY (when type requires), checklist, rehearsal as configured
- Prisma + `scripts/sql/crm-demo-phase14-wave3.sql`
- APIs + thin UI
- Tests: `test/systemAdmin.crm.demoWave3.test.js` (+ Waves 1–2 green)

**Do NOT:** real cloud infra, recording provider, delivery/outcome reports, Proposal create, git commit.

## Rules

- Logical READY only via approved provision path + health check — never invent READY without provisioner
- Reject Production Tenant/data/credentials as data pack source
- Provision/reset idempotent; expiry required
- Never alias MRA EIS sandbox

## Acceptance

- [ ] DENV numbers; provision/reset idempotent; expiry; DEMO banner
- [ ] Production data/credentials rejected
- [ ] Checklist/rehearsal block readiness on Critical fails
- [ ] Vitest PASS

## Report

`.superpowers/sdd/task-p14-3-report.md` — no commit.
