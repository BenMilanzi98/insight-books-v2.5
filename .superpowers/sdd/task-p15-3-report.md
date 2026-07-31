# Task P15-3 Report — Wave 3 Templates, PDF, issue, delivery, review, acceptance

**Task:** Wave 3 — Templates, PDF, issue, delivery, review, acceptance (Phase 15)  
**Date:** 2026-07-31  
**Workspace:** `c:\laragon\www\insight-books-v2.5` (WORKING_TREE; dirty — not reset)  
**Status:** **DONE**

## Summary

Shipped commercial templates/branding foundations, deterministic HTML→PDF render with checksummed private artifacts (append-only; no silent replace), issue + delivery (SECURE_LINK/EMAIL/PORTAL/MANUAL_EVIDENCE), high-entropy review access with expiry/revocation, customer comments/revision requests, acceptance/rejection bound to version+artifact+checksum+recipient+authority, idempotent expiry job, supersession on new issue, withdrawal revokes links, and e-sign boundary `NOT_CONFIGURED`. Thin admin APIs + customer review route/page. Vitest Wave 3 green. No git commit. No Closed-Won readiness full pack (Wave 4).

## TDD evidence

### RED (before implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave3.test.js
❯ test/systemAdmin.crm.commercialWave3.test.js (7 tests | 7 failed)
TypeError: renderCommercialDocument is not a function
TypeError: getESignatureProviderStatus is not a function
…
Test Files  1 failed (1)
     Tests  7 failed (7)
```

### GREEN (after implementation)

```text
npx vitest run test/systemAdmin.crm.commercialWave3.test.js
✓ Issued PDF checksum is stable; regenerate creates new artifact (no silent replace)
✓ Issue retry does not duplicate email/link delivery
✓ View is NOT created from delivery alone
✓ Accept V1 after V2 supersede is blocked
✓ E-sign provider status is NOT_CONFIGURED
✓ Acceptance without checksum fails
✓ Expiry job double-run expires once (idempotent)

Test Files  1 passed (1)
     Tests  7 passed (7)
```

Waves 1+2+3 combined: **25/25 passed**.

## PDF approach

**Deterministic PDF 1.4 serializer** (not a `NOT_AVAILABLE` stub):

1. Build stable HTML projection via `buildDeterministicHtmlDocument` (fixed attribute order; no timestamps).
2. Customer-safe `ISSUED` projection strips `internalNotes` / floors / approval chatter.
3. Serialize a real `%PDF-1.4` binary with fixed object IDs, Helvetica text stream, projection watermarks (`DRAFT`/`INTERNAL`), and embedded `html-sha256:` fingerprint — **no random `/ID`, no CreationDate**.
4. Persist buffer to private storage (`storage.js` memory/filesystem adapter; non-public keys) + `CrmCommercialChecksum` SHA-256.
5. Same content → same checksum; new `idempotencyKey` → **new artifact row** (never silent replace).

## Deliverables

| Area | Paths |
|------|--------|
| Lib | `lib/admin/crm/commercial/` — templates, render, artifacts, checksum, storage, issue, delivery, reviewAccess, customerComments, revisionRequests, acceptance, rejection, expiry, signatureBoundary (+ catalogue/model/index) |
| Prisma | Template/Branding/RenderJob/Artifact/Checksum, Recipient, Delivery, ReviewAccess/Session, CustomerView/Comment, RevisionRequest, Acceptance/Rejection, Expiry, SignatureRequest + Admin relations |
| SQL fallback | `scripts/sql/crm-commercial-phase15-wave3.sql` |
| Admin APIs | `app/api/admin/crm/commercial-issue/`, `commercial-recipients/` |
| Customer | `app/api/crm/customer-commercial-review/`, `app/insightbooks/crm/customer-commercial-review/` |
| Exports | `lib/admin/crm/commercial/index.js` + `lib/admin/crm/index.js` |
| Test | `test/systemAdmin.crm.commercialWave3.test.js` |

## Interfaces implemented

- `renderCommercialDocument({ versionId, projection, idempotencyKey })` → artifact + checksum
- `issueCommercialDocument({ actorContext, commercialDocumentVersionId, artifactId, recipientIds, deliveryMethod, validUntil, idempotencyKey })`
- `recordCustomerView` / `submitCustomerComment` / `submitRevisionRequest`
- `acceptCommercialDocument` / `rejectCommercialDocument` (idempotent; require version+checksum+authority)
- `getESignatureProviderStatus()` → `{ status: 'NOT_CONFIGURED' }`
- `runCommercialExpiryJob` (idempotent); supersession on new issue; `withdrawCommercialDocument` revokes links

## Acceptance checklist

- [x] Vitest Wave 3 PASS (7/7) with listed cases
- [x] Checksummed artifacts; no silent replace
- [x] Issue/delivery idempotent
- [x] Secure review + acceptance/rejection source-backed
- [x] E-sign boundary explicit `NOT_CONFIGURED`
- [x] No commit

## Hard-rule verification (self-review)

| Rule | Evidence |
|------|----------|
| Customer-safe strips internals | `projectContentForAudience` deletes internalNotes/floors/approvalChatter |
| Delivery ≠ view ≠ acceptance | Issue creates delivery only; views via `recordCustomerView`; accept separate |
| Acceptance binds version+artifact+checksum+recipient+authority | `acceptCommercialDocument` requires all; checksum mismatch/missing fails |
| No fabricated signatures | `getESignatureProviderStatus` / SignatureRequest boundary only |
| Supersession blocks V1 accept | New issue → prior SUPERSEDED + access revoked |
| Expiry idempotent | Same job key → `alreadyRan`, single expiry row |
| inventPdf / inventAcceptance forbidden | Domain flags remain true (no fabrication without real render/accept) |
| No Closed-Won pack | Not implemented (Wave 4) |
| No commit | Per instructions |

## Concerns

1. **Prisma generate / db push** not run here (Windows EPERM pattern) — apply `scripts/sql/crm-commercial-phase15-wave3.sql` + regenerate client when safe; `hasCrm*Model` guards degrade to UNAVAILABLE until then.
2. **PDF library choice** — hand-rolled deterministic PDF 1.4 (jsPDF left unused for commercial path due to non-deterministic `/ID`/dates). Suitable for checksum stability; not a full typographic layout engine.
3. **Email delivery** — SECURE_LINK path is primary in tests; EMAIL method records delivery evidence but does not force Phase 13 SMTP when consent/contact gate would block (no fabricated sent mail).
4. **Wave 2 test** updated `wave` assertion to `>= 2` so Wave 3 domain contract does not falsely fail Wave 2.

## Commits

**None** (explicitly forbidden for this task).

## Fix wave (Important)

**Date:** 2026-07-31  
**Trigger:** `task-p15-3-review.md` Important findings 1–3  
**Commit:** none

### Changes

1. **Token-bound accept/reject** (`app/api/crm/customer-commercial-review/route.js`, `acceptance.js`, `rejection.js`)
   - Customer POST `accept`/`reject` now calls `resolveReviewAccessByToken` before acting; invalid/unknown/expired/revoked → 401.
   - Lib accept/reject accept `token` and bind version/recipient/artifact/checksum from resolved access (mismatch fails closed).
2. **`reviewAccess.expiresAt` honored on accept** (`acceptance.js`, also rejection)
   - Active access check rejects when `expiresAt < now` with `review_access_expired` (revoked still `review_access_revoked`).
3. **Authority from verified recipient role** (`acceptance.js` + customer page/GET)
   - `evaluateAcceptanceAuthority`: empty recipient role → `authority_unverified` / `UNVERIFIED` (no default to caller-claimed `SIGNATORY`).
   - GET returns `authorityRole` from recipient; page no longer hardcodes `SIGNATORY`.

### Tests added

- Accept/reject with unknown token fails (must resolve token)
- Expired review access cannot accept
- Empty recipient authority role cannot accept via claimed SIGNATORY

### Vitest output

```text
npx vitest run test/systemAdmin.crm.commercialWave3.test.js

 Test Files  1 passed (1)
      Tests  10 passed (10)
```
