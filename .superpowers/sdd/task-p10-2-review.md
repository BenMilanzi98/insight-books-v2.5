# Task P10-2 Review — Wave 2 Messages + Attachments + Queues/Assignment

**Reviewer:** defect-first task-scoped gate  
**Base / Head:** WORKING_TREE after Task 1 → WORKING_TREE after Task 2  
**Diff package:** `.superpowers/sdd/task-p10-2-review-package.diff` (plus WT cross-check for package gaps)  
**Implementer report:** `DONE_WITH_CONCERNS` — accepted as accurate for scope/risks  

---

## Spec Compliance

| Acceptance | Verdict | Evidence |
|------------|---------|----------|
| Internal / restricted never in `projectForCustomer` | **PASS** | `messages.js` hard-filters `INTERNAL_NOTE` / `RESTRICTED_INTERNAL_NOTE`; unknown types fail closed via `SUPPORT_CUSTOMER_VISIBLE_MESSAGE_TYPES`; SYSTEM_EVENT only if code ∈ empty safe-list (fail closed). Test `projectForCustomer never includes INTERNAL or RESTRICTED notes`. |
| PENDING_SCAN / non-CLEAN not downloadable | **PASS** | Default create → `PENDING_SCAN`; `canDownloadAttachment` requires `CLEAN` + `viewTickets`; `getAttachmentDownload` returns forbidden with scanState. Tests cover PENDING_SCAN, QUARANTINED, INFECTED, SCAN_FAILED, REJECTED, DELETED, UPLOADED, plus CLEAN+ACL. |
| Assignment history; same assignee+queue noop | **PASS** | `assignTicket` returns `{ ok: true, noop: true }` with no history create; reassign appends `SupportAssignmentHistory`; status → `ASSIGNED` only via `canTransition` / `assertTransition`. Tests for assign, noop, reassign, NEW stays NEW. |
| No fake staffing metrics / false zeroes | **PASS** | `listQueues` / seed always force `liveStatus: 'NOT_FOUND'`; no `openTicketCount` / staffing fields; team stubs marked `stub: true`. |
| Vitest Wave 2 (+ Wave 1 regression) | **PASS** (claimed) | Report: 34/34 across messages / attachments / assignment / tickets. Not re-run (no doubt requiring focused verify). |
| Permissions wired (`replyPublicly`, notes, `assignTickets`) | **PASS** | `authz.js` + API/service gates; tests assert permission keys and forbidden paths. |
| Deferred work not implemented | **PASS** | No SLA clocks, My Work UI, email-to-ticket, WhatsApp, portal UI, KB/CSAT, AI replies. |
| Global constraints | **PASS** | Support ≠ CsCase; no billing/MRA fiscal/Tenant GL mutation; CoA admin route not reintroduced; no commit claimed. |

**API surface (brief):** GET/POST messages, GET/POST attachments, download, POST assign, GET queues — present under `app/api/admin/support/` (WT). Private storage under `storage/support-attachments/` (+ `.gitignore`). Prisma models + `scripts/sql/support-ops-phase10-wave2.sql` with FK parity and queue seed `liveStatus = NOT_FOUND`.

---

## Findings

### [P3] Bind attachment download to ticket path — `app/api/admin/support/tickets/[id]/attachments/[attachmentId]/download/route.js`

Nested download route ignores `params.id` and only looks up `attachmentId`. Any admin with `viewTickets` can fetch an attachment via a mismatched ticket URL. Today queue scope is stub `mode: 'all'`, so impact is limited; once queue scoping lands this becomes a cross-ticket IDOR. Pass `ticketId` into `getAttachmentDownload` and 404 when `row.ticketId` does not match.

### [P3] Harden storage-key path join — `lib/admin/support/attachments.js` (`absolutePathForKey`)

`resolved.startsWith(root)` without a trailing separator allows classic prefix siblings (e.g. `…/support-attachments` vs `…/support-attachments2`) if a malicious `storageKey` ever reaches the DB. Keys are currently server-generated (`ticketId/uuid`), so exploitability is low; still fix with `path.resolve(root) + sep` / `path.relative` containment check.

---

## Code quality

- Clear service/API split; visibility and scan gates are service-layer (not CSS).
- Fail-closed defaults (`PENDING_SCAN`, empty customer-safe system codes, catalogue `NOT_FOUND`).
- State machine respected on assign (matches Wave 1 transition pattern).
- Model-unavailable guards consistent with Wave 1 EPERM story.
- Focused Vitest suites map cleanly to acceptance.

**Residual risks (known, non-blocking):** Prisma generate EPERM; team membership stub (empty ⇒ allow); local FS storage without a live scanner (`markScanResult` hook only); upload ACL via `replyPublicly`/`createTickets` rather than a dedicated perm; assign/history not in a DB transaction (same pattern as Wave 1 status history).

**Review-package note:** Diff includes out-of-scope Wave 1 / prior-phase noise (`tickets/route.js` as “new”, large `permissions.js` / analytics / CS schema hunks) and omits several Task 2 paths that exist in WT (messages/attachments/assign routes, `catalogue`/`authz`/`index`/`ticketLookup` deltas). Compliance judged against brief + WT + Task 2-relevant hunks, not package pollution.

---

## Overall

Wave 2 meets the binding acceptance criteria with solid API-enforced boundaries and appropriate deferrals. Only low-severity hygiene items remain; nothing blocks the task gate.

**Task quality:** Approved
