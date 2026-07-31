### Task 3: Wave 3 — Templates, PDF, issue, delivery, review, acceptance

**Depends on:** Task 1 spine + Task 2 pricing/approvals.

**Do NOT git commit.**  
**Do NOT implement:** commercial reports centre, Closed-Won readiness hubs polish, Phase 16 pack docs (Wave 4). You MAY stub readiness hooks if needed for acceptance tests, but full readiness + handoff is Wave 4.

## Goal

Ship templates/branding foundations, deterministic HTML→PDF render with checksummed private artifacts (no silent replace), issue service, delivery (email/secure link/portal/manual evidence; e-sign NOT_CONFIGURED), customer review access (token expiry/revocation), comments/revision requests, acceptance/rejection with version+checksum+authority, expiry/withdrawal/supersession. Vitest green.

## Files

Create under `lib/admin/crm/commercial/`:
- `templates.js`, `render.js`, `artifacts.js`, `checksum.js`, `storage.js`, `issue.js`, `delivery.js`, `reviewAccess.js`, `customerComments.js`, `revisionRequests.js`, `acceptance.js`, `rejection.js`, `expiry.js`, `signatureBoundary.js`

Also:
- `scripts/sql/crm-commercial-phase15-wave3.sql` + Prisma for Template/Branding/RenderJob/Artifact/Checksum, Recipient, Delivery, ReviewAccess/Session, Comment, RevisionRequest, Acceptance/Rejection, Expiry, SignatureRequest (boundary)
- Customer review route: `app/insightbooks/crm/customer-commercial-review/**` (+ token API; high-entropy; non-enumerable)
- Thin admin APIs for issue/delivery/recipients as needed
- Reuse Phase 13 email send where applicable (`lib/admin/crm` email activity)
- Test: `test/systemAdmin.crm.commercialWave3.test.js`

## Interfaces

```js
renderCommercialDocument({ versionId, projection: 'DRAFT'|'INTERNAL'|'ISSUED', idempotencyKey }) // → artifact + checksum
issueCommercialDocument({ actorContext, commercialDocumentVersionId, artifactId, recipientIds, deliveryMethod, validUntil, idempotencyKey })
recordCustomerView / submitCustomerComment / submitRevisionRequest
acceptCommercialDocument / rejectCommercialDocument // idempotent; require version+checksum+authority
getESignatureProviderStatus() // → { status: 'NOT_CONFIGURED' }
// expiry job idempotent; supersession on new issue; withdrawal revokes links
```

## TDD (must cover)

- Issued PDF checksum stable; regenerate ≠ silent replace (new artifact)
- Issue retry → no duplicate email/link
- View NOT created from delivery alone
- Accept V1 after V2 supersede blocked
- E-sign NOT_CONFIGURED
- Acceptance without checksum fails
- Expiry job double-run once

## Hard rules

- Customer-safe projection strips internal notes / floors / approval chatter
- Delivery ≠ view ≠ acceptance
- Acceptance binds exact version + artifact + checksum + recipient + authority
- No fabricated delivery/views/acceptance/signatures
- Provider NOT_CONFIGURED for e-sign
- hasCrm*Model + SQL fallback; no commit

## Acceptance

- [ ] Vitest Wave 3 PASS with listed cases
- [ ] Checksummed artifacts; no silent replace
- [ ] Issue/delivery idempotent
- [ ] Secure review + acceptance/rejection source-backed
- [ ] E-sign boundary explicit
- [ ] No commit

## Report

`.superpowers/sdd/task-p15-3-report.md` with RED/GREEN. Return status + test summary + concerns + path.
