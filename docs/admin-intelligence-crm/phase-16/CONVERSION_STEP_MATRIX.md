# Conversion Step Matrix

| Step code | Depends on | Status today | Wave | Class |
|-----------|------------|--------------|------|-------|
| VALIDATE_EVIDENCE | Acceptance + checksum | Readiness exists; not step row | 1 | CORRECT_AND_REUSABLE input / NOT_FOUND step |
| TRANSITION_OPPORTUNITY_CLOSED_WON | Phase 12 | Service exists; not saga step | 1 | CORRECT_AND_REUSABLE |
| CREATE_OR_LINK_PLATFORM_CUSTOMER | Match decision | NOT_FOUND | 2 | NOT_FOUND |
| CREATE_OR_LINK_TENANT | Customer decision | Admin create FOUNDATION | 2 | FOUNDATION / EXTEND |
| CREATE_BUSINESS / BRANCH | Tenant | FOUNDATION Branch model | 2 | FOUNDATION |
| LINK_CONTACTS | Tenant | NOT_FOUND | 2 | NOT_FOUND |
| CREATE_INITIAL_USER_INVITATIONS | Contacts | NOT_FOUND (temp password risk) | 2 | NOT_FOUND / PRIVILEGED_USER_RISK |
| CREATE_OR_AMEND_SUBSCRIPTION | Snapshot | FOUNDATION services | 3 | FOUNDATION |
| PROVISION_ENTITLEMENTS | Subscription | FOUNDATION helpers | 3 | FOUNDATION |
| CREATE_OR_LINK_BILLING_* / INVOICE | Policy | Platform invoice FOUNDATION | 3 | FOUNDATION |
| INITIATE_PAYMENT_IF_REQUIRED | Invoice | FOUNDATION / NOT_CONFIGURED | 3 | FOUNDATION / PAYMENT_TRUTH_RISK |
| ACTIVATE_SUBSCRIPTION | Policy | NOT_FOUND | 3 | NOT_FOUND |
| ASSIGN_CS | Tenant | Portfolio FOUNDATION | 4 | FOUNDATION |
| ONBOARDING/TRAINING/MIGRATION/MRA_HANDOFF | Tenant | Thin / NOT_FOUND | 4 | FOUNDATION / NOT_FOUND |
| RECONCILE + COMPLETION_CERTIFICATE | All | NOT_FOUND | 4 | NOT_FOUND |

**Rule:** Each step durable with input hash, attempts, outputs, compensation state.
