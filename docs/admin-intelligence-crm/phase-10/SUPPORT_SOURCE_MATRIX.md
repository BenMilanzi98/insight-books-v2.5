# Support Source Matrix

| Concern | Authoritative source | Status today |
|---------|----------------------|--------------|
| Support Ticket | SupportTicket (to build) | NOT_FOUND |
| CS Case | CsCase | READY — distinct |
| Support access session | PlatformSupportAccess | READY — distinct |
| Outbound email | emailService | READY |
| Inbound email→ticket | Mail ingest | NOT_AVAILABLE |
| WhatsApp→ticket | Provider API | NOT_AVAILABLE |
| Customer portal create | Portal | NOT_AVAILABLE |
| Product classification | Phase 9 catalogue codes | READY |
| Billing context | Phase 6 platform billing (read) | READY_WITH_LIMITATIONS |
| MRA context | Entitlement/transmission refs (safe IDs) | CANDIDATE |

**UI rule:** NOT_AVAILABLE channels show explicit unavailable — never fake ticket volume from email history.
