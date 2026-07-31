# Demo Request State Matrix

| State / transition | Today | Wave 1 target | Class |
|--------------------|-------|---------------|-------|
| NEW / SUBMITTED | Lead NEW via capture | DMR NEW | FOUNDATION → EXTEND |
| QUALIFYING | Lead status machine only | DMR QUALIFYING | NOT_FOUND |
| QUALIFIED | — | DMR QUALIFIED | NOT_FOUND |
| CONVERTED → Demo | Lead → Opportunity path only | Idempotent convert → CrmDemo | NOT_FOUND (Opp path ≠ Demo) |
| REJECTED / DISQUALIFIED | Lead disqualify | DMR REJECTED | FOUNDATION pattern |
| CANCELLED / ARCHIVED | Lead archive | DMR archive | FOUNDATION pattern |
| Re-convert same DMR | — | Idempotent no-op / return existing Demo | NOT_FOUND |
| Number DMR-YYYY-###### | — | Immutable unique | NOT_FOUND |

**Rule:** Convert Demo Request ≠ create Opportunity. Opportunity may already exist on Lead; Demo convert is separate idempotent transaction.
