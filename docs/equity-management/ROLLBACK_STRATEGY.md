# Equity Management Rollback

1. Disable `equityManagementV2Enabled` (and related EQUITY_FLAGS).  
2. Keep `/capital-account` legacy contribution path available.  
3. Preserve EqV2 tables, posted journals, holdings, snapshots, audit.  

Must not: delete posted equity journals; count legacy + V2 twice; hide recon exceptions.
