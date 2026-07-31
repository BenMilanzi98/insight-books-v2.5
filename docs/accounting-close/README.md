# Accounting Close (Phase 12)

Month-end / period-end close remains on **Financial Calendar V2** (Phase 8).

This package owns **year-end close**: configuration, readiness, checklist, closing journals (Posting Engine), profit transfer, post-closing trial balance, annual snapshots, FY closure, continuous-ledger carry-forward, and controlled reopen/reclose.

## Key paths

| Area | Path |
|---|---|
| Domain | `lib/accountingClose/domain/` |
| Services | `lib/accountingClose/application/` |
| APIs | `app/api/accounting-close/` |
| UI | `app/accounting-close/page.js` |
| Migration | `prisma/migrations/20260721160000_year_end_close_v2` |
| Flags | `CLOSE_FLAGS` in `featureFlags.js` |
| Permissions | `accountingClose.*` |

## Feature flag

`accountingCloseV2Enabled` (and related CLOSE_FLAGS) are **pre-enabled by default** globally.  
Disable per business with an explicit `AcctV2FeatureFlag` row (`enabled: false`) if needed.

## Docs index

Start with `PHASE_1_TO_11_EVIDENCE_INDEX.md`, `CURRENT_CLOSING_ARCHITECTURE.md`, `CLOSING_DATA_FLOW_MAP.md`, then `FINAL_PHASE_12_REPORT.md`.
