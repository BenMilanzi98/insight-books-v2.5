# Capital Contribution Workflow

1. Create `EqV2EquityTransaction` type `CAPITAL_CONTRIBUTION`  
2. Submit / approve (SoD when configured)  
3. Preview balanced journal (Dr Bank/Asset, Cr Owner Capital)  
4. Post via `postCapitalContributionAccounting` → Posting Engine  
5. Link `journalEntryId` / `accountingEventId` on the transaction  

Does **not** alter ownership percentages unless `altersOwnership` + share issuance path.
