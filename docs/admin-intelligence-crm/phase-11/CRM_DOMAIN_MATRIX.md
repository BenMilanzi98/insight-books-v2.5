# CRM Domain Matrix

| Domain object | Plane | Phase 11 role | Must not conflate with |
|---------------|-------|---------------|------------------------|
| CrmLead | `/insightbooks/crm` | Canonical pre-opportunity sales Lead | Opportunity, Customer, SupportTicket, CsCase |
| CrmAccount | CRM | Sales account / org | Customer (link only), Tenant Client, billing AccountSubscription |
| CrmContact | CRM | Person at account | Platform User (link only), Admin |
| Capture / Source | CRM | Idempotent intake | Contact email notify alone |
| Qualification | CRM | Versioned fit answers | Score, AI chat |
| Score evaluation | CRM | Deterministic explainable score | Win probability, health score |
| Team / Territory / Assignment | CRM | Ownership | SupportQueue/Team, Portfolio, POS sales |
| Consent / Prefs / DNC | CRM | Eligibility | Support message visibility |
| Timeline / Notes / Tasks | CRM | Activity foundations | AdminAuditLog, SupportMessage |
| Duplicate / Merge | CRM | Controlled review | Silent merge, ticket merge |
| Opportunity readiness | CRM | Handoff payload only | Opportunity create, Pipeline, Revenue invent |
| Customer | Intel / Customers | Optional Account link | CRM Account duplicate |
| CsCase / CsExpansionHandoff | Customer Success | Handoff producer | Lead |
| SupportTicket / SupportHandoff | Support | Handoff producer | Lead |
| Tenant POS `sales.*` | Tenant | POS | Platform CRM |

**Architecture B:** Dedicated `lib/admin/crm/*` + `Crm*` Prisma models.
