# Final Phase 10 Review — Support & Service Operations

**Reviewer role:** Senior Code Reviewer (defect-first, whole-branch / working-tree)  
**Date:** 2026-07-30  
**Scope:** Phase 10 Waves 0–4 (Tasks 1–4 via SDD), working tree (no commits)  
**Sources:** `docs/superpowers/plans/2026-07-30-support-ops-phase-10.md`, `docs/superpowers/specs/2026-07-30-support-ops-phase-10-design.md`, `.superpowers/sdd/progress-phase10.md`, `docs/admin-intelligence-crm/phase-10/FINAL_PHASE_10_REPORT.md`, `.superpowers/sdd/final-phase10-review-package.diff`, and live paths under `lib/admin/support/**`, `app/api/admin/support/**`, `app/insightbooks/support/**`, `components/admin/support/**`, SQL wave1–4, tests.

**Exit claim under review:** `READY_FOR_PHASE_11_WITH_BLOCKERS`

---

## Verdict

**Needs fixes before commit.**

Phase 10 delivers a coherent SupportTicket plane (≠ CsCase), with honest channel/foundation contracts, permission-gated messaging, scan-gated downloads, versioned SLA clocks, link-only handoffs, and recon/export foundations. Reported test green (66) and the Phase 11 blocker list are directionally sound.

Two attachment-boundary defects should be fixed in-tree before any commit: **upload max-size gate bypass** and **download path/ticket binding**. Remaining ledger minors and commit-isolation risk are caveats after those fixes.

---

## Findings (severity-ranked)

### [P1] Enforce upload size against actual bytes written — `lib/admin/support/attachments.js`

`createAttachment` prefers caller-supplied `sizeBytes` over `content.length` for the `SUPPORT_ATTACHMENT_MAX_BYTES` check, then writes `content` verbatim when present. A JSON upload with a small declared `sizeBytes` and a large `content` / `contentBase64` body bypasses the size gate and can fill private storage.

The multipart route path sets `sizeBytes` from the buffer (safe). The JSON branch in `app/api/admin/support/tickets/[id]/attachments/route.js` allows independent `sizeBytes` and body content.

**Fix:** Gate on `Math.max(declared, content?.length || 0)` (or reject when they disagree); always persist `content.length` when bytes were written.

---

### [P2] Bind download `attachmentId` to ticket path id (IDOR hygiene) — `app/api/admin/support/tickets/[id]/attachments/[attachmentId]/download/route.js`, `lib/admin/support/attachments.js`

The download route passes only `attachmentId` into `getAttachmentDownload`. Lookup is by attachment primary key with no `ticketId` equality check against `params.id`. Any admin with `viewTickets` who knows/guesses an attachment id can download a CLEAN object even when the URL ticket segment is wrong.

Today queue scope is stubbed to `mode: 'all'`, so blast radius is limited — but the nested route advertises ticket scoping, and real queue scoping will turn this into a hard IDOR. Ledger item **P10-T2** confirmed still open.

**Fix:** Require `ticketId` in `getAttachmentDownload` / route; 404 when `row.ticketId` ≠ resolved ticket id.

---

### [P2] Path containment uses bare `startsWith` — `lib/admin/support/attachments.js` (`absolutePathForKey`)

```js
if (!resolved.startsWith(root)) throw new Error('invalid_storage_key');
```

Without a trailing `path.sep` (or `path.relative` / `!rel.startsWith('..')` check), a sibling prefix such as `{root}-evil/...` passes. Upload keys are generated opaquely today, so exploit needs a poisoned `storageKey` in DB — still defense-in-depth hygiene called out in **P10-T2**.

**Fix:** Compare with `resolved === root || resolved.startsWith(root + path.sep)` (after `path.resolve` on both).

---

### [P2] `Content-Disposition` filename not sanitized for header injection — `app/api/admin/support/tickets/[id]/attachments/[attachmentId]/download/route.js`

Only `"` is stripped from `fileName`. CR/LF or other control characters in an uploaded `fileName` can break or inject response headers. Pair with allowlisting / RFC 5987 `filename*`.

---

### [P2] SLA breach helper can load all clocks — `lib/admin/support/sla/clocks.js` (`evaluateClockBreach`)

Fallback path:

```js
const all = await prisma.supportSlaClock.findMany({});
clock = (all || []).find((c) => c.id === clockId) || null;
```

If `findUnique` / `findFirst` fail or are missing on a partial client, this becomes an unbounded table scan. Prefer fail closed (`notFound`) instead of `findMany({})`.

---

### [P2] Working tree mixes Phase 10 with ~997 dirty paths — commit hygiene

`git status --short` reports on the order of **997** dirty lines. Support-scoped paths are largely new (`lib/admin/support/**`, APIs, UI, SQL, tests) but `prisma/schema.prisma` and `lib/admin/permissions.js` are modified in a tree that still carries Phases 7–9 + Wave 0 churn. Ledger **P10-T1** remains valid: **isolate Phase 10 at commit time** or the first commit will be unreviewable / unsafe to revert.

---

### [P3] `listClocksForTicket` UNAVAILABLE shapes disagree on `ok` — `lib/admin/support/sla/clocks.js`

- Model missing → `{ ok: true, status: UNAVAILABLE, items: [] }`
- Query failure after model present → `{ ok: false, status: UNAVAILABLE, items: [] }`

Consumers that key only on `ok` will treat query failure as hard error vs soft unavailable. Ledger **P10-T3** confirmed; non-blocking but should align (prefer `ok: true` + `status: UNAVAILABLE` for both soft-fail cases, matching create/status SLA hooks).

---

### [P3] `getTicket` / `transitionTicketStatus` swallow Prisma errors as `notFound` — `lib/admin/support/tickets.js`

`catch { row = null }` then returns `ticket_not_found`. Matches CS-style soft degradation (ledger **P10-T1**) but hides outages as 404. Prefer mapping known Prisma codes / rethrowing unexpected errors as `UNAVAILABLE` / 503.

---

### [P3] Attachment metadata may lie when content omitted — `lib/admin/support/attachments.js`

Metadata-only create writes an empty placeholder while storing caller `sizeBytes`. Downstream scanners/UI may trust size. Prefer storing `0` / actual bytes on disk when no content is provided.

---

### [P3] `storageKey` returned in attachment serialization — `lib/admin/support/attachments.js`

Opaque keys are not public paths, but leaking layout (`{ticketId}/{uuid}`) is unnecessary for agent UI. Omit from list/download JSON unless needed.

---

### [P3] No HTTP-level route tests; concurrency tests sequential — ledger **P10-T1**

Service-layer Vitest coverage is solid (tickets/messages/attachments/assignment/SLA/handoffs/recon). Route wiring (auth → status codes → download stream headers) is untested. Acceptable for foundation exit; add at least download + messages permission matrix route tests before treating Support APIs as hardened.

---

### [P3] Detail UI omits attachments — `components/admin/support/SupportTicketDetailView.jsx`

Wave 2 APIs exist; Wave 3 detail covers status, assign, messages, SLA — not upload/list/download. Operable only via API. Align with “attachments boundary” ops story or document as API-only until Phase 11.

---

### [P3] Design “Technical” handoff target omitted — `lib/admin/support/catalogue.js`

Design §5 lists Technical among handoff targets; implementation / final report use CS | PRODUCT | FINANCE | BILLING | MRA only. Document the intentional drop or add `TECHNICAL` as link-only.

---

### [P3] Dead / unreachable branch in recon GET — `lib/admin/support/reconciliation.js` (`getSupportReconciliation`)

After an early `!canViewTickets` return, `if (!access.canRunReconciliation && !access.canViewTickets)` is unreachable. Clean up for clarity.

---

### [P3] Assign eligibility / existence stubs — `lib/admin/support/teams.js`, `assignment.js`

Empty membership ⇒ any `assigneeAdminId` string is eligible; no Admin-row existence check. Documented stub; fine for Wave 2, but ghost assignees will appear in My Work filters until tightened.

---

## Ledger triage (minors)

| Ledger item | Status | Disposition |
|-------------|--------|-------------|
| P10-T1: schema/permissions Phase 7–9 churn | **Open / worse** | ~997 dirty paths; isolate at commit (**P2** process) |
| P10-T1: getTicket/transition swallow errors | **Open** | Confirmed **P3**; CS-style |
| P10-T1: no HTTP route tests; sequential concurrency | **Open** | Confirmed **P3** gap |
| P10-T2: download bind attachmentId ↔ ticket path | **Open** | Confirmed **P2**; fix before commit |
| P10-T2: `absolutePathForKey` startsWith hygiene | **Open** | Confirmed **P2**; fix before commit |
| P10-T3: listClocks `ok` inconsistency | **Open** | Confirmed **P3**; non-blocking |

**New (not in ledger):** upload `sizeBytes` vs content length bypass (**P1**); Content-Disposition sanitization (**P2**); `evaluateClockBreach` full-table fallback (**P2**).

---

## Spec / hard-rules compliance

| Rule | Assessment |
|------|------------|
| SupportTicket ≠ CsCase ≠ Incident ≠ CRM Lead | **Pass** — dedicated models/libs; handoffs `recordOnly` / no CsCase mutation |
| Public ≠ internal/restricted (API-enforced) | **Pass** — typed message creators + filtered `listMessages` / `projectForCustomer` |
| No billing / MRA fiscal / Tenant GL mutation | **Pass** — handoff sanitize + meta flags; export limitations |
| SLA deterministic; ack ≠ first response by default | **Pass** — default `ackCountsAsFirstResponse: false`; pin honor on resume/stop |
| No fabricated tickets/CSAT; no false zeroes | **Pass** — foundations `score: null`; recon honesty helper |
| Email / WhatsApp / portal NOT_AVAILABLE | **Pass** — catalogue + foundations meta |
| CoA admin route stays removed | **Pass** — `REMOVED_ADMIN_ROUTES` unchanged in spirit |
| Numbering SUP-YYYY-###### + CAS seq | **Pass** — `allocateTicketNumber` optimistic CAS |
| State machine never silent coerce | **Pass** — `INVALID_TRANSITION` with reasons |
| Exit READY_FOR_PHASE_11_WITH_BLOCKERS | **Claim accepted** after P1/P2 attachment fixes; blockers list honest |

---

## What looks solid

- Clear domain split and catalogue-driven enums/transitions.
- Permission surface in `resolveSupportAccess` covers view/create/transition/notes/assign/export/recon/handoffs.
- Messages: restricted notes gated; customer projection fail-closed.
- Attachments: private storage root, default `PENDING_SCAN`, CLEAN-only download, `nosniff` + `no-store`.
- SLA: pinned policy/calendar versions; soft-fail around ticket create/transition; breach events append-only intent.
- Handoffs: forbidden payload keys; typed id handling avoids collapsing subscription into invoice.
- Export: export permission rechecked; formula-injection helper; empty ≠ invent.
- SQL fallbacks wave1–4 + Prisma models with FKs/indexes aligned with intended schema.
- UI My Work / list / detail / handoffs / reports / foundations stubs match CS-style honesty patterns.

---

## Test gaps / residual risk

1. No route-level tests for download IDOR, attachment JSON size bypass, or export 403.
2. No scanner integration — `markScanResult` is lib/test-only (good that it is not a public route); production CLEAN transitions need an explicit ops path later.
3. Queue scope stub (`mode: 'all'`) means list ACL is permission-wide until Wave/Phase follow-up.
4. Assign + status history not in a single transaction (history loss on mid-flight failure).
5. Huge mixed working tree — highest process risk at commit time.

---

## Recommended fix order (before commit)

1. **P1** — size gate on actual bytes (`attachments.js` + reject mismatch in JSON route).
2. **P2** — ticketId bind on download service + route.
3. **P2** — path containment with separator / `path.relative`.
4. **P2** — sanitize Content-Disposition filename.
5. **P2** — remove `findMany({})` fallback in `evaluateClockBreach`.
6. Re-run support Vitest pack from FINAL report.
7. At commit time: stage only Phase 10 paths (+ intentional shared permission/schema hunks), not the full ~997-file tree.

---

## Overall readiness

| Question | Answer |
|----------|--------|
| Phase 11 exit honesty (`WITH_BLOCKERS`) | Acceptable after attachment P1/P2 fixes |
| Ready to commit now? | **Needs fixes before commit** |
| After P1 + download bind (+ path/header hygiene)? | **Ready to commit with caveats** (ledger P3s, commit isolation, no HTTP tests, queue stub, UI attachments gap) |

**Final call: Needs fixes before commit.**
