# Support Domain Matrix

| Domain object | Plane | Phase 10 role | Must not conflate with |
|---------------|-------|---------------|------------------------|
| SupportTicket | `/insightbooks/support` | Canonical service ticket | CsCase, CRM Lead, Incident |
| SupportMessage | Support | Conversation (visibility-typed) | Contact demo emails, CRM notes |
| SupportAttachment | Support | Private scanned files | `public/uploads` admin mail |
| SupportQueue / Team | Support | Ownership + assignment | Portfolio alone as queue |
| SupportSlaPolicy / Clock | Support | Versioned clocks | Fake CSAT timers |
| SupportHandoff | Support | Link to CS / Product / Finance / MRA | Source mutation |
| CsCase | `/insightbooks/customer-success` | Retention / playbooks | Support tickets |
| PlatformSupportAccess | PAM | Elevated tenant access sessions | Ticket ACL |
| AnalyticsEvent | Phase 9 | Optional product context codes | Ticket volume metrics |
| Tenant `/support` | Tenant app | Disabled / redirect | Admin Support UI |

**Architecture B:** Dedicated Support domain under `lib/admin/support/*` + Support* Prisma models.
