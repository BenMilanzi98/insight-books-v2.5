# Commercial Documents Phase 15 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/insightbooks/crm` commercial documents — Proposal requests, Proposals, Quotations, CRM Price Books, deterministic pricing/tax/discounts/approvals, PDF artifacts with checksums, secure delivery/customer review, source-backed acceptance, Closed-Won readiness, and Phase 16 handoff payloads — without fabricating commercial evidence or creating Customer/Tenant/Subscription/Invoice effects.

**Architecture:** Approach B waves. Approach 1 domain: `CrmCommercialDocument` + versions as shared spine; `CrmProposal` / `CrmQuotation` typed extensions under `lib/admin/crm/commercial/*`. Real HTML→PDF renderer; e-sign NOT_CONFIGURED; new CRM Price Books; in-platform tax + explicit FX snapshots. Wave 0 docs-only stop gate before Wave 1 code.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 11–14 CRM libs (identity, Opp readiness, Demo handoffs, Email/eligibility), en/ny i18n, private artifact storage.

**Spec:** [docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md](../specs/2026-07-31-commercial-documents-phase-15-design.md)

## Global Constraints

- Proposal ≠ Quotation ≠ Contract ≠ Platform/Tenant Invoice; Acceptance ≠ Closed Won ≠ Subscription ≠ Tenant provision.
- Quoted MRR/ARR/TCV ≠ contracted MRR/ARR ≠ recognised Revenue.
- Issued versions immutable; acceptance binds exact version + artifact + checksum + recipient + authority.
- No silent FX; no fabricated prices/tax/discounts/approvals/delivery/views/acceptance/signatures.
- APPROVED ≠ ISSUED ≠ DELIVERED ≠ VIEWED ≠ ACCEPTED.
- No auto Opportunity stage/probability/close-date/Closed-Won; Phase 16 handoff creates nothing.
- Tenant Quotation domain = WRONG_DOMAIN; e-sign provider NOT_CONFIGURED.
- Metric/report gate fail → never false zero; CoA admin stays removed.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM.
- No AI-generated proposals/pricing/discounts/clauses.

## File map

| Area | Paths |
|------|--------|
| Commercial domain | `lib/admin/crm/commercial/**` (requests, documents, proposals, quotations, pricing, priceBooks, tax, discounts, approvals, templates, render, issue, delivery, review, acceptance, readiness, handoffs, reports, dq, recon) |
| Prisma / SQL | `prisma/schema.prisma` + `scripts/sql/crm-commercial-phase15-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/crm/commercial/**`, `proposal-requests/**`, `proposals/**`, `quotations/**`, `price-books/**`, … |
| UI | `app/insightbooks/crm/commercial/**`, `proposal-requests/**`, `proposals/**`, `quotations/**`, `price-books/**`, `customer-commercial-review/**`, … |
| Opp / Demo extensions | `lib/admin/crm/opportunities/*`, `lib/admin/crm/demos/handoffs.js` consumers |
| Tests | `test/systemAdmin.crm.commercialWave{0..4}.test.js` (Wave 0 may be doc-only) |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-15/*` |

---

### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-15/` audit pack per master prompt §5 / §115 (CURRENT_* commercial audits, matrices, gap register, IMPLEMENTATION_PLAN, FINAL_READINESS_DECISION). No application code.

**Interfaces:**
- Consumes: Phase 14 `PHASE_15_INPUTS.md`, `PHASE_15_READINESS_CHECKLIST.md`, design spec locks
- Produces: CONDITIONAL GO / BLOCKED decision recorded in `FINAL_READINESS_DECISION.md`

- [ ] Validate Phase 14 exit `READY_FOR_PHASE_15_WITH_BLOCKERS` and checklist inputs (Opp/Account/Contact identity, product taxonomy, proposal readiness, Demo handoffs, currency, scope stub, Prisma EPERM)
- [ ] Audit existing surfaces: CRM proposals (none), tenant quotations (WRONG_DOMAIN), Opp commercial estimates, plan/add-on pricing, currency/FX, tax, discounts, approvals, PDF/storage, public links, e-sign — classify with master-prompt taxonomy
- [ ] Write CURRENT_* audits + DQ/recon/privacy/security/performance audits (substantive findings, not empty stubs)
- [ ] Write matrices: commercial source, proposal/quotation domain, Price Book, product pricing, currency/FX, tax, discount, exception, approval, terms/clauses, template, delivery, acceptance, reliability, security
- [ ] Gap register + IMPLEMENTATION_PLAN (maps gaps → Waves 1–4) + FINAL_READINESS_DECISION
- [ ] Stop — **no Wave 1 code** until user chooses execution mode after CONDITIONAL GO

---

### Task 1: Wave 1 — Proposal request + commercial document spine

**Files:**
- Create: `lib/admin/crm/commercial/` — `numbering.js`, `requests.js`, `documents.js`, `proposals.js`, `quotations.js`, `status.js`, `versions.js`, `model.js`, `index.js`, authz helpers as needed
- Create: `scripts/sql/crm-commercial-phase15-wave1.sql`; Prisma models for Request / CommercialDocument / Version / Proposal / Quotation / status history
- Create: APIs under `app/api/admin/crm/proposal-requests/**`, `proposals/**`, `quotations/**`, `commercial/**`
- Create: thin UI hubs `app/insightbooks/crm/proposal-requests/**`, `proposals/**`, `quotations/**`, `commercial/overview`
- Test: `test/systemAdmin.crm.commercialWave1.test.js`
- Modify: Demo handoff consumer to create Proposal Request (idempotent); Opp proposal-readiness path to seed request without creating Proposal

**Interfaces:**
- Consumes: `emitDemoProposalHandoff` payload; `evaluateProposalReadiness`; Phase 11 Account/Contact; `resolveCrmAccess` / `resolveCrmScope`
- Produces:
  - `createProposalRequest({ actorContext, source, sourceRef, opportunityId, …, idempotencyKey })`
  - `qualifyProposalRequest`, `rejectProposalRequest`, `convertProposalRequest` (idempotent → CommercialDocument + Proposal and/or Quotation draft)
  - `createProposal` / `createQuotation` / `createDocumentVersion`
  - `transitionDocumentStatus` (invalid transitions throw)
  - Numbers: `PRQ-YYYY-######`, `PROP-YYYY-######`, `QUO-YYYY-######`, versions `…-V{n}`

- [ ] **Step 1: Write failing Vitest** — request numbering unique; Demo handoff retry returns same `PRQ-`; convert creates PROP/QUO once; invalid status transition throws; issued version edit blocked (foundation flag/guard)
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.crm.commercialWave1.test.js` — expect FAIL (modules missing)
- [ ] **Step 3: Implement** SQL/Prisma + lib services + model guards + thin APIs/UI stubs
- [ ] **Step 4: Re-run Vitest** — expect PASS; confirm no Tenant Quotation reuse; no Opp stage mutation; no PDF/Price Book yet
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Price Books, pricing, tax/FX, discounts, approvals

**Files:**
- Create: `lib/admin/crm/commercial/priceBooks.js`, `productConfig.js`, `lineItems.js`, `pricing.js`, `pricingSnapshot.js`, `currencyFx.js`, `tax.js`, `discounts.js`, `exceptions.js`, `terms.js`, `clauses.js`, `approvals.js`
- Create: `scripts/sql/crm-commercial-phase15-wave2.sql` + Prisma for PriceBook/Version/Entry, TaxRule/RateVersion, DiscountPolicy/Request, PricingException, Term/Clause versions, ApprovalPolicy/Request/Step/Decision, PricingSnapshot
- Create: APIs/UI for price-books, discount-requests, tax-rules, commercial-approvals (thin OK)
- Test: `test/systemAdmin.crm.commercialWave2.test.js`

**Interfaces:**
- Produces:
  - `createPriceBook` / `approvePriceBookVersion` / `activatePriceBookVersion` (ACTIVE immutable)
  - `calculateCommercialDocument({ actorContext, commercialDocumentVersionId, priceBookVersionId, currency, lineItems, taxContext, discountRequests, pricingExceptions, calculationDate, idempotencyKey })` → `{ calculationId, snapshot, totals }`
  - `submitCommercialDocumentForApproval({ actorContext, commercialDocumentVersionId, approvalPolicyVersionId, idempotencyKey })`
  - `decideApprovalStep` with SoD (requester ≠ protected approver)
  - Totals: list/net/tax/grand, quoted monthly/annual recurring, first-year, TCV — currency-explicit

- [ ] **Step 1: Write failing Vitest** — Price Book activate immutability; pricing idempotent snapshot; ZAR+USD not silently summed; missing FX → `FX_CONTEXT_MISSING`; tax override without approval fails; 20% discount above 10% threshold stays pending; self-approve blocked; material qty change invalidates approval
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** pricing engine + policies + approval engine (server-only totals)
- [ ] **Step 4: Re-run Vitest** — PASS; no Tenant tax posting; no MRA EIS fiscal; Opp estimates still non-binding
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Templates, PDF, issue, delivery, review, acceptance

**Files:**
- Create: `lib/admin/crm/commercial/templates.js`, `render.js`, `artifacts.js`, `checksum.js`, `storage.js`, `issue.js`, `delivery.js`, `reviewAccess.js`, `customerComments.js`, `revisionRequests.js`, `acceptance.js`, `rejection.js`, `expiry.js`, `signatureBoundary.js`
- Create: `scripts/sql/crm-commercial-phase15-wave3.sql` + Prisma for Template/Branding/RenderJob/Artifact/Checksum, Recipient, Delivery, ReviewAccess/Session, Comment, RevisionRequest, Acceptance/Rejection, Expiry, SignatureRequest (boundary)
- Create: customer review route `app/insightbooks/crm/customer-commercial-review/**` (+ public/token API as designed, high-entropy, non-enumerable)
- Test: `test/systemAdmin.crm.commercialWave3.test.js`

**Interfaces:**
- Produces:
  - `renderCommercialDocument({ versionId, projection: 'DRAFT'|'INTERNAL'|'ISSUED', idempotencyKey })` → artifact + checksum
  - `issueCommercialDocument({ actorContext, commercialDocumentVersionId, artifactId, recipientIds, deliveryMethod, validUntil, idempotencyKey })`
  - `recordCustomerView` / `submitCustomerComment` / `submitRevisionRequest`
  - `acceptCommercialDocument` / `rejectCommercialDocument` (idempotent; version+checksum+authority)
  - `getESignatureProviderStatus()` → `{ status: 'NOT_CONFIGURED' }`
  - Expiry job idempotent; supersession on new issue; withdrawal revokes links

- [ ] **Step 1: Write failing Vitest** — issued PDF checksum stable; regenerate ≠ silent replace; issue retry no duplicate email/link; view not created from delivery alone; accept V1 after V2 supersede blocked; e-sign NOT_CONFIGURED; acceptance without checksum fails; expiry job double-run once
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** renderer + private storage + issue/delivery/review/acceptance (Phase 13 email where applicable)
- [ ] **Step 4: Re-run Vitest** — PASS; customer-safe projection strips internal notes/floors/approval chatter
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — Hubs, reports, DQ/recon, Closed-Won readiness, Phase 16 pack

**Files:**
- Create: `lib/admin/crm/commercial/readiness.js`, `phase16Handoff.js`, `reports.js`, `reportSchedules.js`, `dataQuality.js`, `reconciliation.js`, `metrics.js`, `reliabilityGate.js`
- Create: `scripts/sql/crm-commercial-phase15-wave4.sql` as needed (handoff, report schedules, DQ incidents, recon runs)
- Create/extend: UI commercial overview/my-work/approvals/expiring/responses; reports centre; Opp commercial + conversion-readiness; Demo timeline handoff consume; permissions/search/cache keys
- Create exit docs: `FINAL_PHASE_15_REPORT.md`, `PHASE_16_INPUTS.md`, `PHASE_16_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md`
- Test: `test/systemAdmin.crm.commercialWave4.test.js`

**Interfaces:**
- Produces:
  - `evaluateClosedWonReadiness({ acceptanceId })` → `NOT_READY|PARTIALLY_READY|READY|BLOCKED|HANDED_OFF`
  - `createClosedWonConversionHandoff({ actorContext, acceptanceId, idempotencyKey })` — payload only; never creates Customer/Tenant/Subscription/Invoice
  - `getCommercialMetric` / report runners with reliability gate (no false zero)
  - Reconciliation + DQ runners with lineage pointers

- [ ] **Step 1: Write failing Vitest** — acceptance → readiness READY when evidence complete; handoff idempotent and creates zero provisioning side effects; Opp stage unchanged; report gate fail ≠ 0; currency-separated overview
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** hubs + reports + DQ/recon + handoff + Phase 16 input pack
- [ ] **Step 4: Re-run Vitest** + regression Phases 12–14 suites touched — PASS
- [ ] Record exit readiness (expect `READY_FOR_PHASE_16_WITH_BLOCKERS` if e-sign/optional providers remain explicit and core truth is solid)
- [ ] SDD final review

---

## Plan self-review

| Spec section | Task coverage |
|--------------|---------------|
| Approach 1 spine + Proposal≠Quotation | Task 1 |
| Price Books + pricing/tax/FX/discounts/approvals | Task 2 |
| PDF/checksum/issue/delivery/review/acceptance/e-sign boundary | Task 3 |
| Reports/DQ/recon/Closed-Won readiness/Phase 16 handoff/UI hubs | Task 4 |
| Wave 0 forensic pack | Task 0 |
| No Tenant Quotation reuse / no auto Closed Won / no provision | Global + Tasks 1–4 tests |
| Approach B sequencing | Tasks 0–4 stop gates |

- Placeholder scan: no TBD/TODO blocking execution.
- Commit steps omitted per global constraint (user must request commits).
- Interface names consistent across tasks (`calculateCommercialDocument`, `issueCommercialDocument`, `createClosedWonConversionHandoff`).
