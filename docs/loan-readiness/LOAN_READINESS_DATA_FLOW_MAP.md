# Loan Readiness Data Flow Map

## Target (implemented)

```
Canonical GL / report snapshots / bank recon / liability register
        ↓
Financial Evidence Dataset (read-only)
        ↓
Approved Forecast version (Phase 13) + Scenario
        ↓
Loan Request Profile + Use of Funds
        ↓
Lender Criteria + Loan Product (versioned, source-labelled)
        ↓
Ratio Engine (liquidity, leverage, profitability, CFADS, DSCR, ICR)
        ↓
Proposed Loan Amortization Engine (exact decimals)
        ↓
Debt Capacity Engine (CFADS ÷ target DSCR − existing service)
        ↓
Stress / Sensitivity (isolated scenarios)
        ↓
Covenant measurements
        ↓
Transparent Readiness Score (weights sum 100%)
        ↓
Risk findings + recommendations
        ↓
Review → Approve → Immutable Snapshot
        ↓
Lender Package / Board Pack / Excel (same payload)
```

## Forbidden paths

- Invoice/expense/payroll table totals as financial truth  
- Proposed facility → Journal Entry / Liability create  
- Frontend-authoritative scores  
- AI altering scores or auto-approving  
- Hidden score plugs  
- Cross-business evidence  
