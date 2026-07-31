# EIS Component Reusability Matrix

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

| Requirement | Component | Path | Class | Changes |
|---|---|---|---|---|
| Entitlement | subscriptionService | lib/subscriptionService.js | EXTEND | Fix hasEISAccess |
| Ops toggle | Tenant.eisEnabled | schema | REUSE_WITH_SMALL_CHANGES | Combine with terminal/block |
| Terminal model | Partial in EISConfiguration.settings | | REIMPLEMENT | Proper terminal aggregate |
| Credentials | EISConfiguration + encrypt | | EXTEND | Encrypt JWT/secretKey; drop OAuth fields |
| Encryption | lib/encryption.js | | EXTEND | Prefer AES-GCM later |
| Config snapshots | settings JSON | | REIMPLEMENT | Versioned config tables |
| Tax mapping | malawiTaxCatalog + heuristics | | REIMPLEMENT | Versioned MRA rate map |
| Product mapping | Missing | | NOT_AVAILABLE | New mapping entity |
| Fiscal sequence | Wrong in eisConfig | | REIMPLEMENT | After Phase 1 KAT |
| Immutable snapshot | Missing | | NOT_AVAILABLE | New |
| Outbox | AcctV2Outbox | | EXTEND | Dispatcher + EIS events |
| Queue/worker | Cron only | | REIMPLEMENT | Durable worker |
| Retries | ad hoc | | REIMPLEMENT | Reconcile-first |
| QR | qrcode.react | | WRAP | MRA URL |
| Receipt | PrintableReceipt | | EXTEND | Pending/validated states |
| Audit | SecV2 + EISSubmissionLog | | EXTEND | Redact |
| Posting engine | accountingV2 | | REUSE_AS_IS | Keep independent of MRA |
| Legacy eisService submit | | | REPLACE | |

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
