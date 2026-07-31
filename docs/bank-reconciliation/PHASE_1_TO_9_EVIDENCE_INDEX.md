# Phase 1–9 Evidence Index (Bank Reconciliation Prerequisites)

Evidence paths only — no invented capabilities. Phase 10 builds on these.

## Architecture & cutover

| Evidence | Path | Relevance |
|---|---|---|
| Phase 10/11/12 readiness stub | [`docs/accounting-integrations/PHASE_10_11_12_READINESS.md`](../accounting-integrations/PHASE_10_11_12_READINESS.md) | Explicitly: bank recon **not started** |
| Fresh-books cutover | [`docs/accounting-integrations/FRESH_BOOKS_CUTOVER.md`](../accounting-integrations/FRESH_BOOKS_CUTOVER.md) | V2-only GL; Transaction archive unused |
| Target architecture | [`docs/accounting-architecture/TARGET_ACCOUNTING_ARCHITECTURE.md`](../accounting-architecture/TARGET_ACCOUNTING_ARCHITECTURE.md) | Posting Engine authority |
| Domain model | [`docs/accounting-architecture/ACCOUNTING_DOMAIN_MODEL.md`](../accounting-architecture/ACCOUNTING_DOMAIN_MODEL.md) | Event → journal lineage |
| Feature flags | [`docs/accounting-architecture/FEATURE_FLAG_STRATEGY.md`](../accounting-architecture/FEATURE_FLAG_STRATEGY.md) | `AcctV2FeatureFlag` pattern |
| Schema audit (no recon tables) | [`docs/accounting-audit/DATABASE_SCHEMA_AUDIT.md`](../accounting-audit/DATABASE_SCHEMA_AUDIT.md) | Confirms absence of statement/match tables |
| GL audit | [`docs/accounting-audit/GENERAL_LEDGER_AUDIT.md`](../accounting-audit/GENERAL_LEDGER_AUDIT.md) | Canonical journal authority |

## Runtime foundations used by Phase 10

| Capability | Path |
|---|---|
| Canonical posted JE lines | [`lib/accountingV2/ledger/canonicalJournalSource.js`](../../lib/accountingV2/ledger/canonicalJournalSource.js) |
| Posting Engine | [`lib/accountingV2/engine/postingEngine.js`](../../lib/accountingV2/engine/postingEngine.js) |
| Bank charge / interest adapters | [`lib/accountingV2/adapters/bankingAdapter.js`](../../lib/accountingV2/adapters/bankingAdapter.js) |
| Bank transfer adapter | [`lib/accountingV2/adapters/remainingAdapters.js`](../../lib/accountingV2/adapters/remainingAdapters.js) |
| Feature flags | [`lib/accountingV2/infrastructure/featureFlags.js`](../../lib/accountingV2/infrastructure/featureFlags.js) |
| Period close checklist (manual stub) | [`lib/accountingV2/periods/periodCloseChecklist.js`](../../lib/accountingV2/periods/periodCloseChecklist.js) — `BANK_RECONCILIATION_REVIEWED` |
| Period close automation | [`lib/accountingV2/periods/periodCloseService.js`](../../lib/accountingV2/periods/periodCloseService.js) |
| Money (signed minor units) | [`lib/accountingV2/domain/money.js`](../../lib/accountingV2/domain/money.js) |
| API route guard | [`lib/accountingV2/api/routeGuard.js`](../../lib/accountingV2/api/routeGuard.js) |
| Accounting permissions catalogue | [`lib/accountingV2/permissions.js`](../../lib/accountingV2/permissions.js) |

## Bank / cash operational surface (pre-Phase 10)

| Capability | Path |
|---|---|
| PaymentAccount + `coaAccountId` | [`prisma/schema.prisma`](../../prisma/schema.prisma) `PaymentAccount` |
| Payment accounts UI | [`app/payments/page.js`](../../app/payments/page.js), [`components/payments/PaymentChannelsPanel.jsx`](../../components/payments/PaymentChannelsPanel.jsx) |
| Payment account channels API | [`app/api/payment-accounts/channels/route.js`](../../app/api/payment-accounts/channels/route.js) |
| Legacy unused BankAccount model | [`prisma/schema.prisma`](../../prisma/schema.prisma) `BankAccount` — **not** recon identity |
| Module specification (docx extract) | [`.cursor/extracted-Bank-Reconciliation-Module.txt`](../../.cursor/extracted-Bank-Reconciliation-Module.txt) |

## Explicit non-evidence (do not confuse)

| Surface | Why not bank recon |
|---|---|
| `/api/accounting-v2/ledger/reconciliation` | GL / report integrity cross-check, not statement matching |
| `/api/accounting-v2/reports/reconciliation` | Report reconciliation findings |
| Cleared flags on legacy payments (if any) | No statement import or recon session tables |

## Phase boundaries

- Phases 1–4: domain, CoA, posting engine, event registry  
- Phase 5–6: ledger + repair  
- Phase 7: reports  
- Phase 8: financial calendar / period close (manual bank recon checklist item)  
- Phase 9: operational adapters including banking  
- **Phase 10:** statement import, matching, completion, snapshots (this module)  
