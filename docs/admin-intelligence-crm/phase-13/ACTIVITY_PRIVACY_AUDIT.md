# Activity Privacy Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Restricted note redaction | CORRECT_AND_REUSABLE | `projectNotesForViewer` omit/redact |
| Consent source-traceable | CORRECT_AND_REUSABLE | `recordConsent` requires source; never infer GRANTED |
| DNC flags | CORRECT_AND_REUSABLE | Per-channel + DO_NOT_CONTACT_ALL |
| Comm prefs | FOUNDATION | `CrmCommunicationPreference` channel preference UNKNOWN default |
| Cross-Tenant Activity links | CORRECT_AND_REUSABLE (policy) | CRM is System Admin plane — must not link Tenant POS entities as Activity subjects |
| Customer API Activity leak | NOT_FOUND (good) | No Customer-facing Activity APIs today |
| Tracking pixels / undisclosed tracking | FORBIDDEN | Must not introduce |
| Call recording privacy stack | NOT_AVAILABLE | Default OFF |

**Implication:** Preserve consent/DNC/restricted-note rules on all outbound Waves; persist eligibility decisions.

