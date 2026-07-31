# MRA EIS Implementation Gap Register

**Date:** 2026-07-22  
**Against:** Official contract pack (`01`–`05`) + master prompt (`MRA EIS Full Implementation.txt`)  
**Legacy baseline:** `CURRENT_IMPLEMENTATION_AUDIT.md`

Gaps are **documentation findings only**. Implementation waits for phased prompts.

| ID | Gap | Severity | Depends on | Phase hint |
|---|---|---|---|---|
| G-001 | No verified sandbox contract tests | BLOCKER | D-001…D-005 | Phase 0 / client foundation |
| G-002 | Credential model is OAuth-era (`clientId`/`clientSecret`/`apiKey`) not terminal JWT+secretKey | BLOCKER | Secrets design | Onboarding / secrets |
| G-003 | Invoice number generator incompatible with MRA guide | BLOCKER | D-002 | Sales fiscalization |
| G-004 | Auth header may be wrong (`Bearer` always) | HIGH | D-005 | HTTP client |
| G-005 | Activation confirmation crypto not proven with known-answer tests in CI | HIGH | D-003 | Onboarding |
| G-006 | Offline HMAC-SHA256 query canonicalization not implemented/verified | HIGH | Guide offline pages | Offline |
| G-007 | Missing swagger endpoints in `eisConfig` (credit/debit, void, tin-auth, …) | HIGH | Matrix C/D | Client catalogue |
| G-008 | No posting-engine → EIS eligibility → transmit lifecycle | HIGH | Accounting V2 | Integration spine |
| G-009 | State machine incomplete vs master prompt (manual review, blocked, offline queued, etc.) | HIGH | Domain design | Domain model |
| G-010 | Two-level enablement (system entitlement + tenant ops) incomplete | MEDIUM | Admin + tenant settings | Enablement |
| G-011 | Config snapshot versioning / refresh on `shouldDownloadLatestConfig` incomplete | MEDIUM | B1 | Configuration |
| G-012 | Terminal block UX / hard-stop transmit incomplete | MEDIUM | D8–D9 | Runtime controls |
| G-013 | Product/UNSPSC mapping workflow incomplete | MEDIUM | D2–D3 | Catalogue mapping |
| G-014 | Stock fiscal ops not first-class vs InsightBooks inventory | MEDIUM | E* | Later phases |
| G-015 | Stale docs still imply OAuth `/invoices/submit` | MEDIUM | D-013 | Docs cleanup |
| G-016 | Master-prompt `x-eis-message-hash` — must not build until verified | BLOCKER (false path) | D-001 | Explicit non-goal until proven |
| G-017 | Encrypted secret handling / no-log guarantees for secretKey | HIGH | Security governance | Secrets |
| G-018 | Idempotent outbox + retry policy aligned to MRA | HIGH | Idempotency Pending | Reliability |
| G-019 | QR / validationURL presentation on receipts | MEDIUM | Sales response | POS/receipt |
| G-020 | Certified `productID` / `productVersion` not recorded in repo | BLOCKER for go-live | MRA certification | Onboarding |

## Suggested phase order (for upcoming prompts)

1. **Contract freeze + sandbox smoke** (ping, activate dry-run with TAC, crypto KATs)  
2. **Secrets + terminal lifecycle**  
3. **HTTP client with verified auth/signing only**  
4. **Config sync**  
5. **Fiscal invoice map + online submit**  
6. **Offline + sync**  
7. **Adjustments / voids**  
8. **Enablement, UI, jobs, observability**  
9. **Stock / advanced utilities** (as required for certification)

Do not reorder into “send POS sales first.”
