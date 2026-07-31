# Current Training Certificate Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training Certificate model / IB-TRN-CERT numbering | NOT_FOUND | No Training certificate tables/services |
| Checksum + verification code + revoke/reissue | NOT_FOUND | Wave 3 `issueTrainingCertificate` |
| Onboarding completion certificate | WRONG_DOMAIN | `onboarding/completion.js` checksum ≠ Training certificate |
| Conversion completion certificate | WRONG_DOMAIN | `conversions/completion.js` ≠ Training certificate |
| Certificate = accreditation | FORBIDDEN | Hard rule — participation/completion only |
| Issue without completion | FORBIDDEN / CERTIFICATE_TRUTH_RISK | Must fail |

**Implication:** Wave 3 checksummed certs; public-safe verify; exact retry same cert; not accreditation.
