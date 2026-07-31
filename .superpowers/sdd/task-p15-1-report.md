# Task P15-1 Report — Wave 1 Proposal Request + Commercial Document Spine

**Task:** Wave 1 — Proposal request + commercial document spine (Phase 15)  
**Date:** 2026-07-31  
**Workspace:** `c:\laragon\www\insight-books-v2.5` (WORKING_TREE; dirty — not reset)  
**Status:** **DONE**

## Summary

Shipped Approach 1 commercial spine: `CrmProposalRequest` + `CrmCommercialDocument` / versions + typed `CrmProposal` / `CrmQuotation`, server numbering (PRQ/PROP/QUO), status machines, issued immutability foundation, Demo handoff → PRQ and Opp readiness seed (request only until convert), thin APIs/UI stubs, Vitest Wave 1 green. No git commit. No Price Books, pricing, PDF, delivery, acceptance, or reports.

## TDD evidence

### RED (before implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave1.test.js
❯ test/systemAdmin.crm.commercialWave1.test.js (6 tests | 6 failed)
TypeError: allocateProposalRequestNumber is not a function
TypeError: createProposalRequestFromDemoHandoff is not a function
TypeError: createProposalRequest is not a function
TypeError: createProposal is not a function
…
Test Files  1 failed (1)
     Tests  6 failed (6)
```

### GREEN (after implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave1.test.js
✓ allocates unique PRQ / PROP / QUO numbers
✓ Demo handoff retry returns the same PRQ (idempotent by handoff identity)
✓ convert creates PROP and/or QUO once; exact retry returns same
✓ invalid document status transition throws
✓ issued version content mutation is blocked (immutability foundation)
✓ reject proposal request and createQuotation are distinct from Proposal

Test Files  1 passed (1)
     Tests  6 passed (6)
Duration  ~20s
```

## Deliverables

| Area | Paths |
|------|--------|
| Lib | `lib/admin/crm/commercial/` — catalogue, numbering, model, requests, documents, proposals, quotations, status, versions, index |
| Catalogue prefixes | `lib/admin/crm/catalogue.js` — PRQ/PROP/QUO + timeline events + number regexes |
| Prisma | `CrmProposalRequest`, status history, `CrmCommercialDocument`, version + status history, `CrmProposal`, `CrmQuotation` + Admin relations |
| SQL fallback | `scripts/sql/crm-commercial-phase15-wave1.sql` |
| APIs | `app/api/admin/crm/proposal-requests/**`, `proposals/`, `quotations/`, `commercial/` |
| UI stubs | `app/insightbooks/crm/proposal-requests/`, `proposals/`, `quotations/`, `commercial/overview/` |
| Wiring | Demo `emitDemoProposalHandoff` → PRQ (idempotent); Opp `evaluateProposalReadiness({ seedProposalRequest: true })` seeds PRQ only |
| Exports | `lib/admin/crm/index.js` + `lib/admin/crm/commercial/index.js` |
| Test | `test/systemAdmin.crm.commercialWave1.test.js` |

## Interfaces implemented

- `createProposalRequest` / `qualifyProposalRequest` / `rejectProposalRequest` / `convertProposalRequest`
- `createProposalRequestFromDemoHandoff` / `seedProposalRequestFromOpportunityReadiness`
- `createProposal` / `createQuotation` / `createDocumentVersion`
- `transitionDocumentStatus` (invalid → throw)
- `updateDocumentVersionContent` (issued → throw immutable)
- Numbers: `PRQ-|PROP-|QUO-YYYY-######`, versions `…-V{n}`

## Acceptance checklist

- [x] Vitest Wave 1 PASS (6/6)
- [x] Numbers server-allocated and unique
- [x] Request convert + Demo handoff idempotent
- [x] Proposal ≠ Quotation distinct models
- [x] Issued immutability foundation guard present
- [x] Thin routes exist (stubs OK)
- [x] No tenant Quotation alias; no Opp auto-mutation; no commit

## Hard-rule verification (self-review)

| Rule | Evidence |
|------|----------|
| Tenant Quotation WRONG_DOMAIN | Domain contract + CRM `CrmQuotation` only; no `app/quotations` imports |
| No Opp stage/probability/close-date mutation | Convert never calls `crmOpportunity.update`; test asserts |
| No PDF / Price Book / acceptance | Not implemented (Wave 2–3) |
| APPROVED ≠ ISSUED | Distinct statuses + transition table; issue path is Wave 3 |
| Invalid transitions fail visibly | `transitionDocumentStatus` throws |

## Concerns

1. **Prisma generate / db push** not run here (Windows EPERM pattern) — apply `scripts/sql/crm-commercial-phase15-wave1.sql` + regenerate client when safe; `hasCrm*Model` guards degrade to UNAVAILABLE until then.
2. **UI stub i18n keys** (`admin-pages.crm.sections.proposalRequests` etc.) may render as raw keys until locale strings are added (Wave 4 hubs acceptable).
3. **`emitDemoProposalHandoff`** now also seeds a PRQ by default (`skipProposalRequest: true` to opt out). Still does **not** create Proposal/Quotation documents (`proposalCreated` remains false until convert).

## Commits

None (per instructions).

## Fix wave (Important)

**Date:** 2026-07-31  
**Status:** DONE (no git commit)

### What changed

1. **`rejectProposalRequest`** (`lib/admin/crm/commercial/requests.js`) — routes reject through shared `transitionProposalRequestStatus` (which enforces `canTransitionProposalRequestStatus` / transition table and appends `CrmProposalRequestStatusHistory`). Illegal from→to (e.g. `APPROVED→REJECTED`, `CANCELLED→REJECTED`) returns `{ ok: false, error: 'invalid_request_status_transition', fromStatus, toStatus }`. Idempotent reject when already `REJECTED` remains OK; `CONVERTED` still returns `proposal_request_already_converted`.

2. **`convertProposalRequest`** — first-time convert to `CONVERTED` uses the same shared transition helper (status update + history + patch for converted document IDs). Already-`CONVERTED` retry only patches document links (no duplicate history).

3. **Vitest** — added `illegal request reject from APPROVED fails visibly` (Minor #7 with Important #1).

### Test command

```text
npx vitest run test/systemAdmin.crm.commercialWave1.test.js
```

### Full relevant test output

```text
 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5


 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  00:48:20
   Duration  7.30s (transform 6.13s, setup 0ms, import 6.73s, tests 72ms, environment 0ms)
```
