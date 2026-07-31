### Task 2: Wave 2 — Public capture + handoffs → Lead + duplicate candidates

**Depends on:** Wave 1 CrmAccount/CrmContact/CrmLead (WORKING_TREE under `lib/admin/crm/*`).

**Files (create / extend):**
- `lib/admin/crm/capture.js` — shared idempotent Lead capture from public forms + handoffs
- `lib/admin/crm/duplicates.js` — create/list/review duplicate candidates (no auto-merge)
- `lib/admin/crm/handoffIntake.js` — CS expansion / Support / Product → Lead (link-only; no source mutation)
- Extend catalogue (source codes per form), authz, index
- Prisma: `CrmDuplicateCandidate` (+ optional `CrmCaptureRecord` if useful for source identity)
- SQL: `scripts/sql/crm-core-phase11-wave2.sql`
- Wire: `app/api/contact/demo-request/route.js` → capture (keep email send if present; Lead must persist)
- New public pages + APIs (reuse capture service):
  - `/request-demo` + API
  - `/start-trial` + API
  - `/sales-enquiry` + API
- Admin APIs: `app/api/admin/crm/duplicates` GET/POST review; handoff intake endpoint(s) under admin crm
- Tests: `test/systemAdmin.crm.capture.test.js`, `test/systemAdmin.crm.duplicates.test.js` (+ handoff coverage)

**Do NOT:** Email/WhatsApp ingest (NOT_AVAILABLE); auto-merge; Opportunity create; scoring/qualification engines; invent consent GRANTED.

## Capture rules

- Validate required fields; sanitize free text; normalize email/phone safely
- Stable source identity + `sourceIdempotencyKey` — exact retries return existing Lead (`idempotent: true`)
- Distinct source codes: `WEBSITE_CONTACT_FORM`, `REQUEST_DEMO`, `START_TRIAL`, `SALES_ENQUIRY` (or SUBSCRIPTION_ENQUIRY per catalogue), handoff codes `CUSTOMER_SUCCESS_HANDOFF`, `SUPPORT_HANDOFF`, `PRODUCT_SIGNAL`
- Channel for public forms: `WEB_FORM`; handoffs: `INTERNAL_HANDOFF`
- Public callers must **not** set owner/team/priority
- Rate-limit / basic spam guards: at least payload size limit + honeypot or simple throttle helper (document if using existing middleware)
- Consent: store only if explicit purpose fields provided; otherwise consent status UNKNOWN — never infer from email/phone submission alone
- Resolve Account/Contact **candidates** (suggest links) — do not auto Customer-link from domain alone

## Handoffs

- From CsExpansionHandoff / SupportHandoff / Product signal: create Lead with EXPANSION or appropriate type; link customer/tenant ids when present
- Exact retry on same handoff id → same Lead
- Do not close/mutate CS case, Support ticket, subscription, or product facts

## Duplicates

- Detect candidates: same source identity, same normalized email, same normalized phone, same handoff ref
- States: NEW, UNDER_REVIEW, LIKELY_DUPLICATE, CONFIRMED_DUPLICATE, CONFIRMED_DISTINCT, … (subset OK for Wave 2)
- **No automatic merge** from similar name/domain alone
- Review API requires permission; records decision + reason + audit fields

## EMAIL / WhatsApp

Catalogue + capture reject or return NOT_AVAILABLE for EMAIL/WHATSAPP ingest paths.

## Pattern references

- Wave 1 CRM + Support capture-adjacent: contact demo-request route
- Matrices: CRM_SOURCE_MATRIX, DUPLICATE_RESOLUTION_MATRIX
- Spec/plan Phase 11

## Global Constraints (binding)

- Lead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase
- Idempotent capture; no fabricated Leads; no inferred consent
- Email/WhatsApp deferred
- CoA admin stays removed
- **Do not git commit.** WORKING_TREE
- Prisma EPERM → SQL + guards

## Acceptance

- [ ] Idempotent capture (exact retries return existing Lead)
- [ ] Distinct source codes per form/handoff
- [ ] Email/WhatsApp marked NOT_AVAILABLE
- [ ] No auto-merge; duplicate candidates only
- [ ] Vitest PASS (+ Wave 1 CRM tests still green)
