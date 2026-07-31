# Tenant module UI adoption status

Presentation-only: `PageHeader` / tokens / patterns. Business logic unchanged.

| Wave | Module | Status | Evidence |
|------|--------|--------|----------|
| 1 | Dashboard | Adopted | `app/dashboard/page.js` → PageHeader |
| 2 | Sales (invoices, clients) | Adopted | `invoice`, `clients` PageHeader + Button |
| 3 | POS | Partial | Title uses text tokens |
| 4 | Purchases | Adopted | `purchases/orders` PageHeader |
| 5 | Expenses | Adopted | `expenses` PageHeader |
| 6 | Stock | Adopted | `stock` PageHeader |
| 7 | Accounting | Adopted | GL v2, bank recon, equity, year-end close |
| 8 | Reports | Adopted | `reports-v2` → ReportLayout |
| 9 | HR | Adopted | `hr/employees` PageHeader |
| 10 | Tax | Adopted | `tax-management` PageHeader |
| 11 | Settings | Adopted | `settings` PageHeader |
| — | Remaining pages | Progressive | Same chrome available; migrate headers as touched |

Platform admin shell: `AdminShell` (Wave 6). Affiliate: token polish on login + dashboard.
