### Task 1: Wave 1 — Proposal request + commercial document spine

**Depends on:** Task 0 CONDITIONAL GO (complete). Design Approach 1 + Approach B.

**Do NOT git commit** (user must request commits).

**Do NOT implement:** Price Books, pricing engine, PDF render, delivery, customer review, acceptance, e-sign, reports (Waves 2–4).

## Goal

Ship Proposal Request + shared commercial document spine with Proposal/Quotation typed extensions, numbering, state machines, versioning/immutability foundations, Demo/Opp request conversion idempotency, thin API/UI stubs, Vitest.

## Files to create/modify

Create under `lib/admin/crm/commercial/`:
- `numbering.js` — PRQ / PROP / QUO via existing `allocateCrmNumber` / `CRM_NUMBER_PREFIX` pattern (extend catalogue)
- `requests.js` — create/qualify/reject/convert Proposal Requests
- `documents.js` — CrmCommercialDocument create/get/list
- `proposals.js` / `quotations.js` — typed extensions
- `status.js` — `transitionDocumentStatus` + request status transitions
- `versions.js` — create version; issued immutability guard
- `model.js` — `hasCrm*Model` guards + serializers
- `index.js` — re-exports
- catalogue constants as needed (statuses, sources, document families)

Also:
- `scripts/sql/crm-commercial-phase15-wave1.sql`
- Prisma models in `prisma/schema.prisma` for: CrmProposalRequest (+ status history), CrmCommercialDocument, CrmCommercialDocumentVersion (+ status history), CrmProposal (+ version payload fields or CrmProposalVersion), CrmQuotation (+ version payload)
- APIs: `app/api/admin/crm/proposal-requests/**`, `proposals/**`, `quotations/**`, `commercial/**` (thin)
- UI stubs: `app/insightbooks/crm/proposal-requests/**`, `proposals/**`, `quotations/**`, `commercial/overview` (thin AdminShell pages OK)
- Export from `lib/admin/crm/index.js` (or commercial barrel)
- Test: `test/systemAdmin.crm.commercialWave1.test.js` — follow `test/systemAdmin.crm.demoWave1.test.js` mock-prisma style
- Wire Demo handoff → create Proposal Request (idempotent by handoff identity); Opp proposal-readiness may seed request without creating Proposal document until convert

## Interfaces (exact names)

```js
createProposalRequest({ actorContext, source, sourceRef, opportunityId, accountId, contactId, demoId, requestedDocumentType, currency, ownerAdminId, idempotencyKey, ... })
qualifyProposalRequest({ actorContext, requestId, ... })
rejectProposalRequest({ actorContext, requestId, reason, ... })
convertProposalRequest({ actorContext, requestId, createProposal, createQuotation, idempotencyKey })
// → CommercialDocument(s) + Proposal and/or Quotation draft V1; exact retry returns same

createProposal({ ... })
createQuotation({ ... })
createDocumentVersion({ documentId, revisionReason, ... })
transitionDocumentStatus({ documentVersionId, toStatus, reason, ... }) // invalid → throw
// Issued version: edit/mutate content blocked (foundation guard)
```

Numbers: `PRQ-YYYY-######`, `PROP-YYYY-######`, `QUO-YYYY-######`, versions `…-V{n}` (or versionNumber int with display `PROP-…-V1`).

## Patterns to reuse

- `lib/admin/crm/numbering.js` + `allocateCrmNumber`
- `lib/admin/crm/demos/*` request/convert/status/model guards
- `lib/admin/crm/authz.js` resolveCrmAccess / resolveCrmScope
- SQL fallback + `hasCrm*Model` if Prisma client lacks models (Windows EPERM)
- Demo: `lib/admin/crm/demos/handoffs.js` — consume; do not set proposalCreated true unless convert actually creates (Wave 1 convert may create draft Proposal — then handoff flag update is OK only when real create happened; never fabricate)

## Hard rules

- Tenant Quotation WRONG_DOMAIN — never import/reuse
- No Opp stage/probability/close-date mutation
- No PDF/Price Book/acceptance yet
- No Customer/Tenant/Subscription/Invoice create
- APPROVED ≠ ISSUED foundations: include status enums even if issue service is Wave 3
- Invalid status transitions fail visibly

## TDD steps

1. Write failing Vitest: numbering unique; Demo handoff retry → same PRQ; convert → PROP/QUO once; invalid transition throws; issued version edit blocked
2. `npx vitest run test/systemAdmin.crm.commercialWave1.test.js` — expect FAIL
3. Implement SQL/Prisma + lib + thin API/UI + model guards
4. Re-run Vitest — PASS

## Acceptance

- [ ] Vitest Wave 1 PASS
- [ ] Numbers server-allocated and unique
- [ ] Request convert + Demo handoff idempotent
- [ ] Proposal ≠ Quotation distinct models
- [ ] Issued immutability foundation guard present
- [ ] Thin routes exist (stubs OK)
- [ ] No tenant Quotation alias; no Opp auto-mutation; no commit

## Report

Write full report to `.superpowers/sdd/task-p15-1-report.md` including TDD RED/GREEN evidence. Return status + one-line test summary + concerns + report path only.
