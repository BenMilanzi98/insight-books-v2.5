# Pipeline Source Matrix

| Source | Producer today | Creates Opportunity | Wave | Class |
|--------|----------------|---------------------|------|-------|
| CRM_OPPORTUNITY_HANDOFF (READY) | `evaluateOpportunityReadiness` | No (payload only) | 1 consumer | READY input |
| Manual Opportunity create (admin) | — | No | Later / restricted | NOT_FOUND — prefer handoff-first |
| Unqualified Lead promote | — | Blocked | — | FORBIDDEN |
| Lead CONVERTED without Opportunity | Lead SM | No | 1 bridge after create | PARTIAL until Wave 1 |
| CS / Support handoff | Lead intake only | No | — | WRONG_DOMAIN for Opportunity create |
| Import (Opportunity) | Foundations IMPORT | No | 4 | FOUNDATION → in-phase |
| Email / WhatsApp inbound | — | No | — | NOT_AVAILABLE (Lead channel) |
| Analytics pipeline events | Ops health APIs | No | — | WRONG_DOMAIN |
| Tenant POS sale | `sales.*` | No | — | WRONG_DOMAIN |
| Partner / legacy Opportunity feed | — | No | Optional | NOT_AVAILABLE (exit blocker OK) |

**Rule:** Create from READY handoff idempotency key first. Never invent Opportunity volume from NOT_AVAILABLE channels or analytics-pipeline.
