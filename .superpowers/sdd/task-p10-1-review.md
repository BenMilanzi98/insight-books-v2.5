# Task P10-1 Review — Wave 1 Support Ticket Model + Numbering + State Machine + APIs

**Re-review after fix pass**  
**Base:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835`  
**Head:** `WORKING_TREE`  
**Diff:** `.superpowers\sdd\task-p10-1-review-package.diff`  
**Prior review:** Important #1 (SQL FKs) + elevated Minors (enum validation, REOPENED clears `resolutionCategory`) claimed fixed.  
**Report trust:** Fix-pass claims checked against the diff and working-tree sources; suite not re-run (11/10→11 accepted as reported). CoA redirect verified on disk (controller).

**Focused checks outside package (named risks):**
1. Review package still omits `tickets/[id]` + `status` API routes → confirmed present and wired on disk.
2. CoA admin page → `app/insightbooks/chart-of-accounts/page.js` redirects to dashboard `notice=coa-removed`.

---

### Spec Compliance

- ✅ **Spec compliant** for Wave 1 ticket core — catalogue, CAS numbering, state machine, ticket service, permissions/nav stubs, Prisma Support* models, SQL fallback with FK parity, list/create API, detail/status routes on disk, and required Vitest behaviors (plus fix-pass coverage) align with the brief.
- ✅ **Catalogue + domain separation** — Support ≠ CsCase ≠ PlatformSupportAccess; enums + transition table + `NOT_AVAILABLE` channels (`lib/admin/support/catalogue.js`).
- ✅ **Numbering `SUP-YYYY-######` (UTC year)** — `SupportTicketNumberSeq` CAS + `$transaction` (`numbering.js`); sequential uniqueness tested.
- ✅ **State machine** — create → `NEW` only; happy path; WAITING_* → IN_PROGRESS|RESOLVED; RESOLVED needs `resolutionCategory`; CLOSED → REOPENED needs reason; terminal-ish need reason; invalid → `INVALID_TRANSITION` never coerce.
- ✅ **Status history append** on create + successful transition.
- ✅ **Ticket fields** — tenantId, portfolioId, status/type/impact/urgency/priority/severity, title/description, resolutionCategory, assignee/queue stubs, `sourceChannel=ADMIN_MANUAL`, timestamps.
- ✅ **Create-time enum validation (fix pass)** — unknown `impact` / `urgency` / `priority` / `severity` / `type` rejected with `invalid_*` (`tickets.js` create path; test coverage).
- ✅ **REOPENED clears resolutionCategory (fix pass)** — with `resolvedAt` / `closedAt`; later RESOLVED without a fresh category fails `INVALID_TRANSITION` (test asserts).
- ✅ **SQL FK parity (fix pass)** — idempotent `DO $$` FK blocks for tenant (CASCADE), portfolio (SET NULL), createdBy/assignee Admin (SET NULL), history ticketId (CASCADE), history changedByAdmin (SET NULL); matches Prisma `onDelete` and CS Phase 8 style.
- ✅ **No billing/MRA/Tenant GL mutation** — support lib only touches `supportTicket*` / `supportTicketNumberSeq` / history.
- ✅ **Permissions + nav stubs** — active keys + SECURITY_MATRIX stubs; `/insightbooks/support` (+ children) → `viewTickets`.
- ✅ **APIs** — list/create in package; GET detail + POST status on disk with 401/403/404/400/503 mapping.
- ✅ **Distinct from CsCase** — separate models/paths; test asserts no `csCase.create`.
- ✅ **Deferred correctly** — no messages/attachments/queues UI/SLA/portal/email-to-ticket; no commit.
- ✅ **CoA admin route stays removed** — page redirects to dashboard notice.
- ⚠️ **Cannot verify from diff:** live `prisma generate` / DB apply of SQL fallback (EPERM path documented; unit tests use mocks). Platform Support *role pack* seed outside this diff (JSON grants + Super Admin break-glass match CS pattern).

---

### Fix-pass adjudication (prior Important / elevated Minors)

| Prior finding | Status |
|---------------|--------|
| SQL missing FKs vs Prisma / CS `DO $$` pattern | **Fixed** — six idempotent FK blocks with correct `ON DELETE` |
| Create does not validate impact/urgency/priority/severity | **Fixed** — catalogue set checks + Vitest |
| REOPENED leaves stale `resolutionCategory` (?? reuse) | **Fixed** — cleared on REOPENED; test blocks reuse |
| Schema/permissions churn (Phase 7–9) | **Not a Must Fix** (controller) — keep as Minor/process for commit hygiene |
| Package omitted detail/status routes | **Still omitted from package**; routes verified on disk — demote to Minor/process |

---

### Strengths

- Clean brief-aligned split (`catalogue` / `numbering` / `stateMachine` / `authz` / `tickets` / `index`).
- Table-driven transitions with contextual gates and explicit `INVALID_TRANSITION`.
- Dedicated sequence table + optimistic CAS; UTC year; zero-padded format.
- List hard-cap 100; create forces `ADMIN_MANUAL`; deferred channels `NOT_AVAILABLE`.
- EPERM path: SQL apply steps + `hasSupportTicketModel` degrade; FKs now match Prisma.
- Fix-pass tests cover enum rejection and reopen→resolve without stale category.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None remaining for Wave 1 acceptance._

#### Minor (Nice to Have)

1. **Review package / working-tree scope pollution** — `prisma/schema.prisma` and `lib/admin/permissions.js` still include large non–Task-1 surface (Analytics*, Cs*, InvoiceItemTax, PlatformPlanVersion, intel/CS nav, `INTEL_CRM_PERMISSION_SCAFFOLD`, `adminHasPermission` → `authorizeAdminDecision`). Functional Support work is fine; **isolate or acknowledge before commit** (process/hygiene; not a Spec Compliance blocker per controller).

2. **Review package omits required API route files** — `tickets/[id]/route.js` and `tickets/[id]/status/route.js` still absent from `task-p10-1-review-package.diff` but present and correctly wired on disk. Include in future packages.

3. **`getTicket` / `transitionTicketStatus` swallow Prisma errors as `notFound`** — DB/client failures can surface as 404. Matches CS `cases.js` degrade style; prefer distinguishing unavailable/5xx when the model exists.

4. **No HTTP-level route tests** — lib coverage is solid (11 tests); route wiring is thin but untested.

5. **Encoding artifacts in the review package** (`ΓÇö` / `Γëá`) — packaging mojibake; UTF-8 on disk for support sources is fine.

6. **Concurrency tested only sequentially** — acceptable per brief (“race-ish sequential”); CAS is the parallel safety mechanism. Optional later: short `Promise.all` allocate test.

---

### Assessment

**Task quality:** Approved

**Reasoning:** Wave 1 Support ticket behavior matches the brief. The prior Important SQL FK gap and the two elevated Minors (create-time enum validation; clear `resolutionCategory` on REOPENED) are fixed in the working tree with tests. Remaining items are process/hygiene (unrelated schema/permissions churn in the package, omitted routes in the diff file) or pre-existing CS-style degrade patterns — none block Wave 1 acceptance.
