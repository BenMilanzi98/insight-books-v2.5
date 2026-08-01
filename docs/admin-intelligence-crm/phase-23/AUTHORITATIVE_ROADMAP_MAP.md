# Authoritative Roadmap Map — Phase 23

| PRD Phase | Repo location | Behaviour found | Correction |
|-----------|---------------|-----------------|------------|
| 14 Lead Capture | `CrmLead`, `CrmCaptureRecord`, `app/insightbooks/crm/leads` | `source`+`channel`, capture idempotency, consent snapshot | CRM source evidence — not Campaign SoT |
| 15 Qualification | CRM qualification models | Qualification ≠ fabricated MQL | Keep distinct |
| 16 Pipeline | `CrmOpportunity` | No attribution credits | EXTEND later for sourced/influenced |
| 18 Demo | `lib/admin/crm/demos` | Demo source lineage | Demo ≠ acquisition without campaign evidence |
| 22 Training | tree phase-18 ≡ PRD 22 | Forbids marketing attribution | Honour boundary |
| Affiliate | `Affiliate*`, `/insightbooks/affiliate*` | Commission referrals | DISTINCT from Marketing Campaign |
| Product Analytics | `/insightbooks/intelligence/product-analytics` | Product funnels | DISTINCT from Marketing touchpoints |
| GL "marketing" expense | CoA 5330 remaps | Accounting | WRONG_DOMAIN for attribution spend |
| Phase 23 Marketing | `/insightbooks/marketing` | **Does not exist** | Create as sole canonical family |

Do not trust folder names alone; behaviour above governs classification.
