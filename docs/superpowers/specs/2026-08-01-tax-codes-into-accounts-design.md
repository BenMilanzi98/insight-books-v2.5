# Merge Tax Codes into Tax Accounts

**Date:** 2026-08-01  
**Status:** Approved  

## Decision

`/tax-management/accounts` hosts both **Tax codes** and **Balances** as tabs. Remove dedicated Tax codes nav/route (redirect to accounts).

## Implementation notes

- Components: `TaxCodesManagement`, `TaxAccountsBalances`
- Shell: `app/tax-management/accounts/page.js` with `?tab=codes|balances`
- Redirects: `/tax-management/tax-codes`, `/tax-types` → accounts; `/tax-accounts` → `?tab=balances`
- Sidebar: drop Tax codes item
