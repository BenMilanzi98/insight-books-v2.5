# Current Communication Preference Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Channel preferences (email / phone / WhatsApp) | NOT_FOUND | — |
| Quiet hours / locale prefs on Contact | NOT_FOUND | — |
| Eligibility service before outbound | NOT_FOUND | — |
| Demo-request email send | PARTIAL | Outbound notify to hard-coded inbox — not Contact preference enforcement |
| WhatsApp CTA | PARTIAL | User-initiated chat; no preference store |
| Support message visibility prefs | WRONG_DOMAIN | Ticket message visibility ≠ CRM prefs |

**Implication:** Wave 3 communication preferences + DNC eligibility before any CRM outbound. Do not treat Support visibility or inbox notify as preference plane.
