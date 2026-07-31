# Current Call Management Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmCall model | NOT_FOUND | Absent from Prisma |
| Call plan / log / complete services | NOT_FOUND | No `lib/admin/crm/calls/*` |
| Telephony provider adapter | NOT_AVAILABLE | Design-locked boundary; no dialer / CTI integration in CRM |
| Call recording | NOT_AVAILABLE / FORBIDDEN invent | No recording stack; legal/consent retention not present |
| DNC for CALL channel | CORRECT_AND_REUSABLE | `CRM_DNC_FLAG.DO_NOT_CALL` + eligibility CHANNEL_TO_DNC |
| Call eligibility consumer | PARTIAL | `checkCommunicationEligibility` supports CALL but no Call Activity caller |
| UI/API | NOT_FOUND | No `/calls` CRM hubs |
| Support phone / CS intervention channel | WRONG_DOMAIN | Support/CS channels ≠ Sales Call Activity |

**Implication:** Wave 2 builds manual/planned Call Activity; telephony + recording stay typed NOT_AVAILABLE.

