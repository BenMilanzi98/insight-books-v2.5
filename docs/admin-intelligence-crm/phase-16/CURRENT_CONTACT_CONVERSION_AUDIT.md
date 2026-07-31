# Current Contact Conversion Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| CrmContact | CORRECT_AND_REUSABLE | Phase 11 Contact plane |
| Handoff contactId | CORRECT_AND_REUSABLE | `phase16Handoff` payload includes `contactId` |
| Link Contacts → Tenant Users | NOT_FOUND | No LINK_CONTACTS step |
| Consent / eligibility for invites | CORRECT_AND_REUSABLE / EXTEND | Phase 13 fail-closed UNKNOWN |
| Contact privacy projections | FOUNDATION | Wave 4 must reuse CRM privacy projections |

**Implication:** Wave 2 links Contacts as invite targets; never invent Users without invitation flow.
