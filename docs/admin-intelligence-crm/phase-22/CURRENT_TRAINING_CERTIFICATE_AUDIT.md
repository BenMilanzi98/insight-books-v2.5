# Current Training Certificate Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Issue requires ParticipantCompletion | CORRECT_AND_REUSABLE | `certificates.js` issueTrainingCertificate |
| Checksum + verification code | CORRECT_AND_REUSABLE / EXTEND | sha256 checksum + randomBytes verify |
| Numbering IB-TRN-CERT- | CORRECT_AND_REUSABLE | TRAINING_CERTIFICATE_NUMBER_RE |
| Revoke | PARTIAL / EXTEND | TRAINING_CERTIFICATE_VERIFICATION.REVOKED |
| ≠ accreditation / entitlement | CORRECT_AND_REUSABLE | Domain contract certificateAccreditationForbidden |
| Public verify PII-safe | EXTEND | serializeTrainingCertificatePublic |

**Implication:** Certificates reusable; Wave 3 hardens eligibility UNKNOWN≠issue + revoke/supersede history.

