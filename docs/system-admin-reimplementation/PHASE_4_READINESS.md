# Phase 4 Readiness — Affiliates, Android, Email

**Status:** Production-ready (exit gate passed)

## Delivered

### Affiliates
- Schema: `AffiliateReferral.paymentId` + `idempotencyKey` (unique); `AffiliatePayout.periodKey` + `idempotencyKey` (unique).
- Helpers (`lib/admin/affiliateIntegrity.js`):
  - `assertUniqueReferralCode`, `calculateCommission`, `commissionIdempotencyKey`, `payoutIdempotencyKey`, `commissionReversalKey`, `maskPaymentDetails`
- APIs:
  - `GET/POST /api/admin/affiliate/commissions` — idempotent create; one payment → one commission
  - `GET/POST /api/admin/affiliate/payouts` — idempotent per affiliate+period
  - Affiliate list returns `bankDetailsMasked` only (no raw payment details)
- UI: `/insightbooks/affiliate/commissions`, `/insightbooks/affiliate/payouts` (+ nav sub-items)
- Permissions: `manageCommissions`, `approvePayouts` gated on write paths

### Android / mobile-app
- Schema: `MobileAppConfig.apkChecksum`, `apkFileSize`, `releaseChannel`
- Helpers (`lib/admin/androidRelease.js`): secret denylist, SHA-256 checksum validation, release channels
- `/api/admin/mobile-app` persists/returns public release metadata only — **signing credentials never accepted or returned**
- Admin UI for APK publishing remains App Center redirect; API is the hardened control surface

### Email
- Schema: `PlatformEmailTemplate` (versioned), `PlatformEmailSuppression`
- Helpers (`lib/admin/emailSafety.js`): `maskSecret`, `shouldResendOnly`, `sanitizeTemplateVariables`
- APIs:
  - `GET/POST /api/admin/email/templates` — versioned templates; rejects SMTP secrets
  - `POST /api/admin/email/retry` — existing log id only; skips suppressed recipients; **no business duplicate**
  - `GET/POST /api/admin/email/suppression`
- UI: `/insightbooks/email-management/templates`, `/insightbooks/email-management/suppression`

### Redirects (unchanged)
- `/insightbooks/affiliate-system` → `/insightbooks/affiliate`
- `/insightbooks/audit-logs` → `/insightbooks/audit` (Phase 5 surface)

## Tests
- `test/systemAdmin.phase4.test.js`
- Prior: `test/systemAdmin.affiliateIntegrity.test.js`, `test/systemAdmin.emailSafety.test.js`

## Residual (non-blocking)
- Denormalized affiliate totals may drift — schedule a reconcile job in ops.
- Wire commission creation into the live platform payment webhook when payments settle (API ready; caller wiring is product ops).
- Full SMTP send worker should honor suppression list on all enqueue paths (retry path already does).
