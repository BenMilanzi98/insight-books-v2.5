# Current Opportunity Product Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Opportunity line products | NOT_FOUND | No Opportunity product join |
| Product interest on Lead | PARTIAL / READY as context | Lead/handoff may carry product interest; ≠ committed lines |
| Phase 9 product catalogue | CORRECT_AND_REUSABLE | Link/reference for estimates; not Invoice lines |
| Subscription / SKU as Opportunity product | WRONG_DOMAIN | Provisioning later |
| Unknown product interest exception | READY (readiness) | `allowUnknownProductInterest` on handoff |

**Implication:** Wave 2 non-binding Opportunity products referencing catalogue where known; unknown interest remains explicit, not fabricated SKUs.
