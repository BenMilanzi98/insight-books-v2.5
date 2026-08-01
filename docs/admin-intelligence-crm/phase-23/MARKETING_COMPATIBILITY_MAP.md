# Marketing Compatibility Map

| Existing system | Relationship to Phase 23 | Decision |
|-----------------|--------------------------|----------|
| `CrmLead.source` / `channel` | Evidence for Lead acquisition | Preserve original; map via versioned rules |
| `CrmCaptureRecord` | Capture + consent + payload | REUSE_WITH_RECONCILIATION |
| `CrmConsentRecord` | Contact consent | REUSE for comms eligibility; visitor consent is new |
| `CrmOpportunity` | Conversion target | EXTEND sourced/influenced links |
| Conversion / Closed-Won (P20) | Customer/subscription outcome | Consume identities |
| AffiliateReferral | Partner channel candidate | Explicit Partner mapping later; keep commission SoT |
| AnalyticsEvent (P4) | Event envelope | Marketing producers use outbox/idempotency |
| Product Analytics Events | Product usage | Never auto-create Marketing touchpoints |
| Training Participants | Enablement | Never auto-create Leads or acquisition credit |
| Demo records | Demo lineage | Influence only with campaign evidence |
| Revenue Intelligence (P6) | Collected/recognised revenue | Sole ROAS revenue source |
