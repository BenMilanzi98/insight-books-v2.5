# Commercial Documents Phase 15 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Surface:** `/insightbooks/crm/proposals`, `/quotations`, `/commercial/*`, `/price-books`, `/proposal-requests`, customer-commercial-review, commercial-reports  
**Architecture:** Approach 1 — `CrmCommercialDocument` shared spine; Proposal/Quotation typed extensions under `lib/admin/crm/commercial/*` (and related modules)  
**Upstream exit:** Phase 14 `READY_FOR_PHASE_15_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-14/PHASE_15_INPUTS.md`)

---

## 1. Purpose

Deliver one authoritative, versioned, deterministic commercial-document plane for InsightBooks platform Sales: Proposal requests through qualification and conversion, Proposals and Quotations with Price Book–backed pricing, governed tax/discounts/exceptions/approvals, deterministic PDF artifacts with checksums, secure customer delivery and review, source-backed acceptance/rejection, expiry/revision/supersession, Closed-Won readiness evaluation, and Phase 16 conversion handoff payloads — without fabricating commercial evidence, mixing quoted value with Revenue, or creating Customer/Tenant/Subscription/Invoice/Payment effects.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Domain spine | **Approach 1** — `CrmCommercialDocument` + versions own status/approvals/delivery/artifacts/acceptance; `CrmProposal` / `CrmQuotation` typed extensions |
| Proposal vs Quotation | Distinct entities; may link (Proposal pins exact Quotation version IDs); never merged into one unversioned object |
| PDF | **Real deterministic renderer** (HTML → PDF); draft/internal/issued watermarks; checksummed private artifacts; regeneration = new artifact; never silent replace |
| E-signature | **Boundary only** — models + states; provider **NOT_CONFIGURED**; no fabricated signatures |
| Price Books | **New CRM Price Books** (versions + entries); Phase 9 Product/Plan/Add-on version refs; Opp commercial estimates remain non-binding |
| Tax / FX | **In-platform** commercial tax rules + rate versions; FX only via named approved source + rate + timestamp + snapshot; no Tenant tax posting; no MRA EIS fiscal submission |
| Sequencing | **Approach B** — Wave 0 → 1 → 2 → 3 → 4 with SDD stop gates |
| Tenant Quotation | **WRONG_DOMAIN** — do not reuse `app/quotations` / tenant Quotation models |
| Opportunity mutation | Acceptance never auto-changes stage / probability / close date / Closed Won |
| Exit | Expect **`READY_FOR_PHASE_16_WITH_BLOCKERS`** when core commercial truth is trustworthy and optional providers remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM |

---

## 3. Hard rules

- Proposal ≠ Quotation ≠ Contract ≠ Platform Invoice ≠ Tenant Invoice.
- Acceptance ≠ executed Contract ≠ Closed Won ≠ Subscription activation ≠ Tenant provisioning.
- Quoted MRR/ARR/TCV ≠ contracted MRR/ARR ≠ billed/collected/recognised Revenue.
- Issued document versions are immutable; acceptance binds exact version + artifact + checksum + recipient + authority + method + timestamp + evidence.
- Every priced line identifies Price Book, version, entry, list/applied price, currency, effective date, exception source when used.
- No silent FX conversion; no fabricated prices, taxes, discounts, approvals, delivery, views, comments, acceptance, or signatures.
- APPROVED ≠ ISSUED ≠ DELIVERED ≠ VIEWED ≠ ACCEPTED.
- Material changes after approval/issue create a new version; supersede prior issued version only when the new version is issued.
- Protected discounts/exceptions/Price Books/tax overrides/clauses enforce Segregation of Duties (no self-approve).
- Customer-safe projections exclude internal notes, price floors, approval discussions, restricted clause guidance, competitor strategy.
- Metric/report gate fail → never fabricated zero.
- Phase 16 handoff creates nothing (Customer/Tenant/Subscription/Invoice/Payment).
- No AI-generated proposals, pricing, discounts, or legal clauses.
- System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA unchanged; no accounting/billing/MRA EIS fiscal behaviour changes.

---

## 4. Domain architecture

```text
Opportunity proposal readiness / Demo proposal handoff / sales|CS|partner request
        ↓
CrmProposalRequest (PRQ-YYYY-######)
        ↓ qualify / approve / convert (idempotent)
CrmCommercialDocument (PROP-|QUO-YYYY-######)
        ├── CrmCommercialDocumentVersion (…-V{n})  [shared spine]
        │     ├── status history
        │     ├── pricing snapshot (Quotations; optional commercial summary on Proposal)
        │     ├── approvals (policy/steps/decisions)
        │     ├── recipients + eligibility
        │     ├── render jobs + artifacts + checksums
        │     ├── deliveries + review access + view events
        │     ├── comments / revision requests
        │     ├── acceptance / rejection / deferment
        │     ├── signature boundary (NOT_CONFIGURED)
        │     └── expiry / withdrawal / supersession
        ├── CrmProposal extension — narrative sections, scopes, assumptions, exclusions,
        │     responsibilities, milestones; pins exact Quotation version ID(s)
        └── CrmQuotation extension — Price Book version, currency, line items,
              discounts/taxes, commercial totals; standalone or linked

Price Books (PB-) / Tax rules / Discount policies / Terms / Clauses / Templates / Approval policies
        ↓
Closed-Won readiness → CrmClosedWonConversionHandoff (payload only → Phase 16)
```

**Numbering:** Server-generated, unique, concurrency-safe, never recycled: `PRQ-`, `PROP-`, `QUO-`, version `…-V{n}`, Price Book `PB-` (exact prefixes locked in Wave 1 implementation).

**Reuse:** Phase 11 Account/Contact/consent; Phase 12 Opportunity + proposal/conversion readiness; Phase 13 Email/Task/Follow-Up/eligibility; Phase 14 Demo proposal handoff; Phase 9 product taxonomy; AdminShell + en/ny.

**Do not alias:** Tenant Quotation/Invoice, Platform Invoice, Opp commercial estimates as issued truth, Subscription pricing as mutable live quote without Price Book snapshot, MRA EIS fiscal documents.

---

## 5. State machines (summary)

### Proposal request
`NEW` → `UNDER_REVIEW` → `INFORMATION_REQUIRED` | `QUALIFIED` | `REJECTED` | `DUPLICATE` → `PENDING_APPROVAL` → `APPROVED` → `CONVERTED` | `CUSTOMER_DEFERRED` | `CANCELLED` | `ARCHIVED`

Do not create customer-facing documents from unqualified requests without approved exception.

### Proposal / Quotation (document version)
`DRAFT` → preparation/pricing → `INTERNAL_REVIEW` | `CHANGES_REQUIRED` → `PENDING_APPROVAL` → `APPROVED` → `READY_TO_ISSUE` → `ISSUED` → `DELIVERED` / `VIEWED` / `CUSTOMER_REVIEW` → `REVISION_REQUESTED` | `ACCEPTED` | `REJECTED` | `CUSTOMER_DEFERRED` | `EXPIRED` | `WITHDRAWN` | `SUPERSEDED` | `CANCELLED` | `ARCHIVED`

Invalid transitions fail visibly. Quotation may use `PRICING_IN_PROGRESS` / `VALIDATION_FAILED` in the preparation band.

---

## 6. Pricing, tax, FX, discounts, approvals

### Services (canonical, server-side, idempotent)
- `calculateCommercialDocument` — validate actor/scope/products/Price Book/currency/quantities → list & applied prices → discounts/exceptions → tax → rounding → recurring/one-time/first-year/TCV/grand totals → immutable pricing snapshot; exact retry returns same calculation.
- `submitCommercialDocumentForApproval` — resolve versioned policy; create steps; SoD; notify; idempotent.
- `issueCommercialDocument` — require APPROVED/READY_TO_ISSUE + artifact + checksum + eligible recipients; lock issued version; create delivery requests; idempotent.
- Delivery / accept / reject / revise / expire / withdraw / supersede — discrete services; no state conflation.

### Price Books
Types include STANDARD, ENTERPRISE, PARTNER, GOVERNMENT, PROMOTIONAL, LEGACY, CUSTOMER_SPECIFIC, etc. ACTIVE versions immutable. Entries reference Phase 9 product/plan/add-on/service versions with unit, list/min price, billing frequency, quantity bands, tax category, effective dates. Customer-specific books remain customer-scoped. Expired books cannot price new documents without approved exception. Historical documents retain historical Price Book versions (never reprice issued docs from current books).

### Totals (labels never interchangeable)
List subtotal · net subtotal · tax total · grand total · quoted monthly recurring · quoted annual recurring · first-year total · total contract value — all currency-explicit; never labelled contracted or recognised Revenue.

### Tax
Document-level tax context (jurisdiction, inclusive/exclusive, categories, rate versions, rounding, calculation date). Overrides require permission + approval + evidence. No Tenant GL tax postings; no MRA EIS fiscal submission from quotations.

### FX
Default same-currency. Conversion requires approved named source, rate, effective timestamp, source/target currency, snapshot, approval where required. Missing/stale FX → reliability states (`FX_CONTEXT_MISSING`, `STALE`, etc.); no silent convert; no false combined multi-currency totals.

### Discounts & exceptions
Policy-driven thresholds and floors; request before effective application; protected paths require approval; requesters cannot self-approve. Exceptions (manual unit price, below minimum, nonstandard frequency/duration/payment/tax/product combo, etc.) require reason/evidence/approval/expiry. Material changes invalidate affected approvals.

---

## 7. Issue, delivery, customer review, acceptance

### Rendering & storage
Deterministic render jobs for draft / internal-review / approved / issued (and superseded/archived presentations). Artifacts retain document ID, version, template/clause pins, pricing snapshot, language, actor, time, file hash, size, MIME, private storage location, watermark/classification. Issued PDF never silently replaced.

### Delivery
Methods: `EMAIL_ATTACHMENT`, `EMAIL_SECURE_LINK`, `CUSTOMER_REVIEW_PORTAL`, `MANUAL_DELIVERY_WITH_EVIDENCE`, `E_SIGNATURE_PROVIDER` (NOT_CONFIGURED), `OTHER_APPROVED`. States distinguish provider acceptance vs delivered vs viewed vs accepted. Phase 13 email send reused where applicable. Eligibility enforced (consent, do-not-email, role). Idempotent issue and delivery; provider callbacks deduplicated.

### Customer review
High-entropy token; expiry; revocation; recipient binding; optional OTP foundation; rate limiting. Customer-safe projection only. View events only when authorised access successfully opens/renders the document — not from email send, link creation, or open tracking alone.

### Acceptance & rejection
Methods: secure portal acknowledgement, approved email confirmation, manual evidence, purchase-order reference; e-sign when configured later. Required fields: document, exact version, artifact, checksum, recipient identity/role, authority state, method, statement, timestamp/timezone, evidence, policy version. Authority states: `VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `DECLARED_BY_RECIPIENT`, `UNVERIFIED`, `REJECTED`, `NOT_REQUIRED`. Protected policy rejects unverified recipients. Default: block acceptance of superseded/expired/withdrawn versions unless explicit approved exception. Rejection uses canonical reasons; competitor selection never fabricated. Idempotent callbacks.

### Closed-Won readiness & Phase 16 handoff
Post-acceptance deterministic readiness (`NOT_READY` | `PARTIALLY_READY` | `READY` | `BLOCKED` | `HANDED_OFF`). Handoff payload includes Opportunity, Proposal/Quotation IDs and versions, artifact checksum, acceptance identity/authority/method, Account/Contacts, products/plan/add-ons/quantities, currency, pricing snapshot, tax/discounts/terms, scopes, idempotency key. **Creates nothing.** Does not mutate Opportunity stage/probability/close date.

---

## 8. Waves

| Wave | Focus |
|------|--------|
| 0 | Forensic audits + matrices + gap register + IMPLEMENTATION_PLAN + readiness decision (docs only); stop before code |
| 1 | Proposal request + commercial document spine + Proposal/Quotation models + numbering + state machines + versioning/immutability foundations + Demo/Opp request conversion idempotency + thin API/UI stubs |
| 2 | Price Books + product configuration + line items + pricing service/snapshots/totals + currency/FX + tax + discounts/exceptions + terms/clauses foundations + approval engine + SoD |
| 3 | Templates + branding + PDF render/checksum/storage + issue + delivery + customer review + comments/revision requests + acceptance/rejection + expiry/withdrawal/supersession + e-sign boundary |
| 4 | Commercial overview/my-work/approvals/expiring/responses hubs + reports/exports/schedules + DQ + reconciliation + lineage + Closed-Won readiness + Phase 16 handoff + Opp/Demo/Account extensions + permissions/search/cache + Phase 16 input pack |

---

## 9. UI & API sketch

**Hubs:** `/insightbooks/crm/commercial` (overview, my-work, approvals, expiring, customer-responses, settings), `proposal-requests`, `proposals/[proposalId]/*`, `quotations/[quotationId]/*`, `price-books`, pricing-rules/discount-policies/tax-rules/terms/clauses/templates, `commercial-approvals`, `customer-commercial-review`, `commercial-reports`, duplicates/merge-review as governed ops.

**Extend:** Opportunity commercial / products / approvals / proposal-readiness / conversion-readiness / timeline; Demo outcome/follow-up/timeline; Account commercial/timeline.

**APIs:** `app/api/admin/crm/commercial|proposal-requests|proposals|quotations|price-books|…` — server pagination/filter/sort; scope + FLS; honesty envelopes on metrics.

**Early waves:** Thin route stubs acceptable; authoritative behaviour lives in `lib/admin/crm/*` services + Vitest.

---

## 10. Reliability, DQ, reconciliation

Commercial reliability gate evaluates identity, versions, Price Book, currency/FX, tax, discount/exception approvals, snapshot, template/clauses, approval/delivery/response evidence, freshness, DQ, reconciliation, permission, privacy projection. Failed gate → structured unavailable/warning states — **never false zero**.

DQ rules cover requests, documents, line items, pricing, tax, approvals, artifacts, delivery, acceptance (per master prompt catalogue). Reconciliation covers request→document→pricing→approval→artifact→delivery→response→handoff lineage with variance and remediation paths.

---

## 11. Testing & verification (per wave)

Vitest coverage includes: request/Demo-handoff idempotency; numbering; state machines; version immutability; pricing determinism/idempotency; currency separation; FX missing blocks; tax no Tenant/MRA side effects; discount SoD; approval invalidation on material change; issue/delivery idempotency; secure-link expiry/revocation; view≠delivery; acceptance version+checksum+authority; superseded acceptance policy; e-sign NOT_CONFIGURED; expiry job idempotency; Closed-Won readiness; Phase 16 handoff creates nothing; report honesty; scope/PII/security regressions for Phases 12–14.

SQL fallbacks + model guards when Prisma client lacks generated models (Windows EPERM pattern).

---

## 12. Out of scope (explicit)

- Automatic Customer / Tenant / Subscription / Plan/add-on activation / Platform or Tenant Invoice / Payment / revenue recognition / Tenant accounting postings
- Automatic Opportunity stage / probability / close-date / Closed Won
- Complete contract lifecycle management; onboarding/training execution
- Live e-signature provider; AI proposals/pricing/discounts/clauses
- Sales quotas / commissions / formal forecasting
- Reuse of tenant Quotation domain as CRM commercial truth
- Accounting, platform billing, or MRA EIS fiscal behaviour changes
- Reintroduction of System CoA admin routes

---

## 13. Approval

Conversational design sections §1–§4 **approved** 2026-07-31.  
**This file:** user-reviewed and **approved** 2026-07-31. Next: implementation plan → Wave 0.
