# Opportunity Domain Matrix

| Domain object | Plane | Phase 12 role | Must not conflate with |
|---------------|-------|---------------|------------------------|
| CrmOpportunity | `/insightbooks/crm` | Canonical deal | Lead, Customer, Subscription, Proposal, Invoice |
| CrmPipeline / Stage | CRM | Versioned stage catalogue | analytics-pipeline, Lead status |
| CRM_OPPORTUNITY_HANDOFF | CRM | Create input (READY) | Opportunity invent, Revenue invent |
| Commercial estimate | CRM | Non-binding amount | Phase 6 MRR/ARR, Invoice totals |
| Probability | CRM | Explainable win estimate | Lead fit score, ML, Revenue certainty |
| Close date | CRM | Provenance + confidence | Fabricated forecast dates |
| Contact role | CRM | Buying-role on Opportunity | Platform User grant |
| Win/loss | CRM | Close outcome + evidence | Tenant provision |
| Proposal readiness | CRM | Handoff payload | Proposal document create (Phase 13+) |
| Conversion readiness | CRM | Handoff payload | Auto Tenant create |
| CrmLead / Account / Contact | CRM | Upstream identity | Opportunity itself |
| Customer / Revenue | Intel | Boundary link only | Opportunity value |
| analytics-pipeline | Ops | Health/dispatch | Sales Pipeline |
| Tenant POS `sales.*` | Tenant | POS | Platform CRM Pipeline |

**Architecture:** Extend `lib/admin/crm/*` + `CrmPipeline*` / `CrmOpportunity*` — not a separate POS/Revenue plane.
