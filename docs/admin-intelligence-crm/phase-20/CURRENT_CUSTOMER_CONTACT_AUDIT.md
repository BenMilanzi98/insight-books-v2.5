# Current Customer / Contact Conversion Audit (PRD 20)

**Audited:** 2026-07-31

| Check | Status | Class | Evidence |
|-------|--------|-------|----------|
| Platform Customer create/link | PARTIAL | EXTEND | `customerProvision.js` `createOrLinkPlatformCustomer` |
| Match decisions persisted | READY | CORRECT_AND_REUSABLE | `CrmConversionMatchDecision` + `customerMatch.js` |
| No auto-merge | READY | CORRECT_AND_REUSABLE | `decideCustomerCreateOrLink` — POSSIBLE_MATCH blocks create |
| Contact link step | PARTIAL | EXTEND | `businessBranch.js` `linkContactsForConversion` |
| Consent preservation | PARTIAL | EXTEND | Present as intent; deepen consent/spam gates Wave 2 |
| Cross-Customer contact deny | GAP | EXTEND | Must fail closed when Contact already bound to other Customer |
| Roles (PRIMARY/BILLING/…) | PARTIAL | FOUNDATION | Payload/link roles partial — deepen Wave 2 |
| Overwrite verified Customer with weak CRM data | READY (intent) | EXTEND | Link path preferred on EXACT; harden no-weaken policy Wave 2 |

**Implication:** Customer/Contact spine exists; Wave 2 Critical gaps = EXACT_MATCH block auto-create, cross-Customer deny, consent.
