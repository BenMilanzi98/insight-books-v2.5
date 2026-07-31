# Support Data Quality Audit

| Risk | Treatment |
|------|-----------|
| Ticket without Tenant | Block create |
| CsCase mistaken for ticket | Forbidden mapping |
| Contact email as ticket | Forbidden |
| Public storage attachments | Forbidden for Support |
| Missing SLA context | Metric → SLA_CONTEXT_MISSING not 0% |
| Cross-tenant participant | Reject |

**Gate:** Critical DQ blocks affected metrics/reports.
