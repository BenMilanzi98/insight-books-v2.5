# Phase 11 — CRM Core Foundation

**Surface:** `/insightbooks/crm`  
**Architecture:** Approach B — dedicated CRM domain (≠ Customer, SupportTicket, CsCase, Tenant Client, POS `sales.*`)  
**Design:** `docs/superpowers/specs/2026-07-30-crm-core-phase-11-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-30-crm-core-phase-11.md`  
**Handoff in:** `docs/admin-intelligence-crm/phase-10/PHASE_11_INPUTS.md`  
**Phase 1 gaps:** `docs/admin-intelligence-crm/CRM_GAP_REGISTER.md`

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Complete (2026-07-30) |
| 1 | Account / Contact / Lead models, numbering, status SM, manual APIs, permissions/nav stubs | Complete (WORKING_TREE) |
| 2 | Public capture + dedicated forms; CS/Support/Product handoff→Lead; duplicate candidates | Complete (WORKING_TREE) |
| 3 | Qualification + scoring; teams/territories/assignment; consent/DNC | Complete (WORKING_TREE) |
| 4 | Timeline/tasks/notes; merge; opportunity readiness; UI; import/report stubs; Phase 12 pack | Complete (WORKING_TREE) |

**Phase exit:** see `FINAL_PHASE_11_REPORT.md` — **READY_FOR_PHASE_12_WITH_BLOCKERS**  
**Phase 12 pack:** `PHASE_12_INPUTS.md`

## Hard rules

- Lead ≠ Opportunity ≠ Customer ≠ Support Ticket ≠ CsCase
- CRM Account may link to Customer; must not duplicate billing/MRR/subscription truth
- Contact ≠ Platform User (verified link only)
- Capture idempotent; consent never inferred; DNC via eligibility service
- Qualification ≠ scoring; score ≠ win probability; no AI scoring/messages
- No silent merges; Email / WhatsApp Lead ingest remain `NOT_AVAILABLE` + contracts
- Tenant POS `sales.*` is WRONG_DOMAIN — never alias as CRM

## Classification legend

| Class | Meaning |
|-------|---------|
| READY | Usable as-designed for Phase 11 consumption |
| PARTIAL | Exists but incomplete / not CRM-shaped |
| NOT_FOUND | Absent in codebase / schema |
| WRONG_DOMAIN | Exists but belongs to another plane |
| NOT_AVAILABLE | Explicitly deferred with contract |
| BLOCKED | Cannot proceed until dependency cleared |
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| FORBIDDEN | Must not be reused as CRM truth |
