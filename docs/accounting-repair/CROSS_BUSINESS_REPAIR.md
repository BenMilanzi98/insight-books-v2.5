# Cross-Business Repair

Cross-tenant defects are CRITICAL and follow the strictest workflow
(`CROSS_BUSINESS_REPAIR`, approval: Finance Manager + Super Administrator,
separation of duties).

Detection `P6-XTEN-001`: journal lines whose account belongs to a different
business than the journal (the primary mechanical symptom of tenant bleed).

## Procedure

1. Freeze further use of the affected record; record a security incident where
   data exposure occurred.
2. Prove rightful ownership: source ownership, account ownership, user access,
   business-switcher state at creation, blast radius (other affected records).
3. Reverse the effect in the wrong business (HREP- reversal, scoped to that
   business).
4. Repost in the rightful business through the posting engine (separate
   business-scoped action; every account/period/dimension validated against the
   rightful business).
5. Repair source links (metadata repair); validate no cross-business references
   remain (re-run P6-XTEN-001); verify reports for BOTH businesses.
6. Notify authorized stakeholders per policy.

`businessId` mutation on a posted journal is not a repair primitive anywhere in
the codebase: it is not in any metadata whitelist and the execution service
refuses cross-business targets. Multi-tenant guards (anomaly, batch, journal,
account, period, approval all validated against `context.tenantId`) are
security-test covered, including "executor from business B cannot execute
business A's repair".
