# Task P11-1 Review — Wave 1 CRM Account / Contact / Lead

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p11-1-review-package.diff`  
**Brief / report:** `task-p11-1-brief.md` / `task-p11-1-report.md`  
**Report trust:** Acceptance claims checked against working-tree sources + package; Vitest not re-run (11/11 accepted as reported). CoA admin page redirect verified on disk.

---

### Spec Compliance

- ✅ **Spec compliant** for Wave 1 CRM core — `lib/admin/crm/*` (catalogue, numbering, stateMachine, authz, accounts, contacts, leads, index), Prisma `Crm*` + `CrmNumberSeq`, SQL fallback with idempotent FK `DO $$` blocks, admin APIs, live `systemAdmin.crm.*` Wave 1 keys + stubs, nav stubs, and required Vitest coverage align with the brief.
- ✅ **Numbering** — `LEAD|ACC|CON-YYYY-######` (UTC year, 6-digit seq); `CrmNumberSeq` compound PK + optimistic CAS in `$transaction`; never recycled; format + sequential uniqueness tested.
- ✅ **Canonical statuses** — full Wave 1 list (NEW … ARCHIVED) in catalogue; create → `NEW` + `ADMIN_MANUAL`; happy path NEW → … → QUALIFIED → OPPORTUNITY_READY enforced; invalid → `INVALID_TRANSITION` (no silent coerce).
- ✅ **DISQUALIFIED** requires non-empty `disqualificationReason` (assert + persist); tested.
- ✅ **CONVERTED_TO_OPPORTUNITY blocked** — omitted from transition table; `canTransition` false; `assertTransition` / service return `NOT_IMPLEMENTED`; tested.
- ✅ **Status history** appended on create and successful transition (`CrmLeadStatusHistory`).
- ✅ **Distinctness** — separate models/API paths from Customer, SupportTicket, CsCase; create Lead does not touch CsCase/SupportTicket; POS `sales.*` unused for CRM authz (tested).
- ✅ **CRM Account ≠ Customer** — optional `customerId` / `tenantId` link fields only; no billing/GL/MRA secrets; PROSPECT default.
- ✅ **Contact ≠ Platform User** — no national ID / bank / passwords; optional account link; email normalize.
- ✅ **Channels** — EMAIL / WHATSAPP `NOT_AVAILABLE`; create hardcodes `ADMIN_MANUAL` (no fake ingest).
- ✅ **Deferred correctly** — no public forms, scoring, consent, merge, Opportunity, Email/WhatsApp ingest, teams/territories UI; capture idempotency not faked as full Wave 2 pipeline (optional `sourceIdempotencyKey` replay only).
- ✅ **Permissions + nav** — live Wave 1 keys; stubs for later waves; `NAV_PERMISSION_MAP` for `/insightbooks/crm` (+ leads/accounts/contacts); `crmNav.js` wired into `adminNav.js`; Super Admin break-glass via existing decision service.
- ✅ **APIs** — accounts/contacts/leads GET/POST + `[id]` GET; leads `[id]/status` POST; 401/403/404/400/503 mapping; list limit capped at 100.
- ✅ **EPERM path** — SQL script + `hasCrm*Model` guards.
- ✅ **CoA admin route stays removed** — `app/insightbooks/chart-of-accounts/page.js` redirects to dashboard `notice=coa-removed`; nav still documents removal.
- ✅ **No git commit** — WORKING_TREE per brief/report.
- ⚠️ **Cannot verify from diff:** live `prisma generate` / DB apply of SQL (EPERM path documented; unit tests use mocks).

### Acceptance checklist

| Criterion | Status |
|-----------|--------|
| Unique LEAD/ACC/CON numbering (concurrency-safe) | ✅ |
| Canonical statuses + invalid transition rejection | ✅ |
| Distinct from Customer / SupportTicket / CsCase | ✅ |
| Vitest PASS (reported 11/11) | ✅ (not re-run) |
| CONVERTED_TO_OPPORTUNITY blocked | ✅ |
| DISQUALIFIED needs reason | ✅ |

---

### Strengths

- Clean Support Wave 1–shaped split; table-driven transitions with contextual DISQUALIFIED / Phase-12 convert gates.
- Dedicated seq table + CAS; immutable numbers after allocate.
- Domain comments and model shapes reinforce Lead ≠ Opportunity ≠ Customer ≠ Support ≠ CsCase.
- List hard-cap; channel availability catalogue; status history on create/transition.
- Tests map cleanly to the nine required behaviors (plus accounts/contacts create/get and POS unused).

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None for Wave 1 acceptance._

#### Minor (Nice to Have)

1. **`editLeads` implies `canTransitionStatus`** — `authz.js` allows transition when `editLeads` is granted (Support keeps transition behind `transitionStatus` only). Brief allows “or equivalent,” so not a compliance miss; prefer Support-strict separation so grants stay independently auditable.

2. **`createLead` does not pre-validate `accountId` / `contactId`** — unlike `createContact`’s account check; bad IDs rely on Prisma FK → API 500. Soft-validate and return `account_not_found` / `contact_not_found`.

3. **Optional `sourceIdempotencyKey` race** — check-then-create without `P2002` replay; concurrent duplicates can 500 and burn a number. Acceptable for Wave 1 (full capture idempotency is Wave 2); handle unique conflict as replay when Wave 2 lands.

4. **Status update + history not one transaction** — same Support pattern; history failure can leave status advanced without a history row. Prefer `$transaction` wrapping update + history append later.

5. **Review package / working-tree scope pollution** — `adminNav.js`, `permissions.js`, and `prisma/schema.prisma` hunks in the package also surface Phase 5–10 surface as additions vs package base. Functional CRM work is fine; isolate or acknowledge before commit (process/hygiene).

6. **No HTTP-level route tests** — lib coverage is solid; route wiring is thin and untested.

7. **Encoding artifacts in the review package** (`ΓÇö` / `Γëá`) — packaging mojibake; UTF-8 on disk for CRM sources is fine.

8. **Numbering concurrency tested only sequentially** — CAS is the parallel safety mechanism; optional later: short `Promise.all` allocate stress.

---

### Assessment

Wave 1 CRM Account / Contact / Lead behavior matches the brief: numbering, canonical state machine (including DISQUALIFIED reason and blocked convert), distinct domain models/APIs, permissions/nav stubs, SQL+guards, and the required Vitest matrix. Remaining items are hygiene, Support-parity polish, or deferred Wave 2 capture hardening — none block acceptance.

**Task quality:** Approved
