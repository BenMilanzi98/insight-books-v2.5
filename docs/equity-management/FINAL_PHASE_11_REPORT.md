# Final Phase 11 Report — Equity Management

## 1. Executive summary

Phase 11 implements Equity Management V2 on additive `EqV2*` tables: business equity configuration, owner/partner/shareholder relationships, versioned holdings, equity transactions posting exclusively through the Accounting Posting Engine, dividends, ownership transfers, reconciliation, statements, APIs, UI, permissions, flags, tests, and rollout docs.

## 2–3. Evidence & current architecture

See `PHASE_1_TO_10_EVIDENCE_INDEX.md` and `CURRENT_EQUITY_ARCHITECTURE.md`. Prior product surface was Capital Account contributions only; drawings/dividends were template/adapter scaffolds.

## 4–5. Target architecture & database

- Models: `EqV2Configuration`, `EqV2PartyRelationship`, `EqV2ShareClass`, `EqV2OwnershipHolding`, `EqV2OwnershipMovement`, `EqV2EquityTransaction`, dividend tables, approvals, documents, reconciliation runs/findings, snapshots  
- Migration: `prisma/migrations/20260721140000_equity_management_v2`  
- Legacy `EquityAccount` retained but **not** authoritative  

## 6–31. Implementation highlights

| Area | Location |
|---|---|
| Config / parties / ownership | `lib/equityManagement/application/*` |
| Transactions + Posting Engine | `transactionService.js` → `postCapitalContributionAccounting` / `postOwnerDrawingAccounting` / `submitViaCutover` |
| Dividends | `dividendService.js` — declare once (Dr RE), pay clears payable |
| Owner loan vs capital | `OWNER_LOAN_ADVANCE` vs `CAPITAL_CONTRIBUTION`; conversion type supported |
| Share issuance premium | `shareCapitalAndPremium` exact split |
| Transfers | Ownership-only by default (no company JE) |
| Subledger / capital statement | `reconciliationService.js`, `capitalAccountService.js` |
| Integrity | EQT-001/003/012/026/027/035 etc. in recon engine |
| APIs | `/api/equity-management/**` |
| UI | `/equity-management` |
| Permissions | `equity.*` in `permissionsMap.js` |
| Flags | `EQUITY_FLAGS` in `featureFlags.js` |

## Confirmations (acceptance)

1. Financial equity txs use the centralized Posting Engine.  
2. Equity balances for statements derive from posted EqV2 txs linked to journals — not typed balances.  
3. Capital contributions are never classified as Revenue in posting builders.  
4. Drawings debit Owner Drawings, not operating expense.  
5. Dividend declaration debits Retained Earnings / credits Dividends Payable; payment does not debit RE again.  
6. Owner loans use liability mapping unless `OWNER_LOAN_CONVERSION`.  
7. Contributions do not auto-change ownership % (`altersOwnership` / explicit issuance only).  
8. Ownership holdings are versioned (close + new row).  
9. Owners with history cannot be hard-deleted.  
10. Cross-business IDs rejected via tenant-scoped queries.  
11. MK1,000,000 duplicate detection via recon rule EQT-035.  
12. No plug / Suspense balancing journals.  
13. Posted journals are not modified by this module.  

## Pilot checklist

- [ ] Enable `equityManagementV2Enabled`  
- [ ] Configure legal structure + equity model  
- [ ] Create owner relationship  
- [ ] Post MK contribution once; verify single JE  
- [ ] Post drawing; confirm Income Statement unaffected  
- [ ] (If company) share class + issuance with premium  
- [ ] Dividend declare + partial pay  
- [ ] Run equity reconciliation  
- [ ] Compare SOCE / BS equity (Phase 7 reports)  

## Phase 12

See `PHASE_12_READINESS.md`.
