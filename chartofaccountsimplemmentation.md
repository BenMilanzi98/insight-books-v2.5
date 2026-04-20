# AI Agent Developer Prompt: Chart of Accounts Standardization & Migration

---

## Overview

You are an AI agent tasked with rebuilding and standardizing the **Chart of Accounts (CoA)** system. This is a **critical financial data migration task** — every action must follow **GAAP/IFRS accounting principles**, maintain full **audit trail integrity**, and ensure **zero data loss** across all tenants.

---

## Phase 0: Pre-flight Checks & Safety Setup

Before touching any data, you must:

1. **Snapshot the entire CoA table** (and all related transaction tables) into a migration audit log. This is your rollback point.
2. **Wrap all mutations in a database transaction** — if any step fails, the entire migration rolls back.
3. **Create a `coa_migration_log` table** (if not exists) with columns: `original_account_id`, `original_code`, `original_name`, `original_type`, `mapped_to_code`, `mapped_to_name`, `tenant_id`, `migrated_at`, `status`.
4. **Lock the CoA for writes** during migration (set a `coa_locked` system flag per tenant) so no new transactions post to old accounts mid-migration.
5. Confirm you have access to the following tables/endpoints before proceeding:
   - Chart of accounts master
   - Journal entries / general ledger
   - Sub-ledger references (AR, AP, inventory, payroll)
   - Tenant registry

---

## Phase 1: Define the Canonical Chart of Accounts

Implement the following **canonical CoA** as the authoritative account structure for the system. Every account below must be created (or confirmed present) in the master CoA table before any migration runs. These are **immutable system accounts** — no tenant may rename or delete them.

```
ASSETS (1000)
├── Current Assets (1100)
│   ├── Cash - Main Account (1110)
│   ├── Cash - Petty Cash (1120)
│   ├── Bank & Mobile Money - Primary (1130) (those created in /payments page)
│   │   ├── Bank (1130-01)
│   │   ├── Mobile Money (1130-01)
│   │   ├── Wallet (1130-01)
│   │   └── POS Teminal (1130-02)
│   ├── Accounts Receivable (1200)
│   ├── Prepaid Expenses (1210)
│   ├── Advances to Suppliers (1215)
│   └── Inventory (1300)
│       ├── Stock on Hand (1310)
│       ├── Raw Materials (1320)
│       └── Goods in Transit (1330)
├── Fixed Assets (1500)
│   ├── Property & Equipment (1510)
│   ├── Furniture & Fittings (1520)
│   ├── Motor Vehicles (1530)
│   ├── Computer Equipment (1540)
│   └── Accumulated Depreciation (1590)
└── Other Assets (1900)
    ├── Long-term Deposits (1910)
    ├── Intangible Assets (1920)
    └── Other Assets - Miscellaneous (1999) ← catch-all for 1000–1999 unclassified

LIABILITIES (2000)
├── Current Liabilities (2100)
│   ├── Accounts Payable (2110)
│   ├── VAT Payable - MRA (2120)
│   ├── PAYE Payable (2130)
│   ├── Accrued Expenses (2140)
│   ├── Deferred Revenue (2150)
│   └── Short-term Loans (2160)
└── Long-term Liabilities (2500)
    ├── Bank Loans - Long-term (2510)
    ├── Shareholder Loans (2520)
    └── Other Liabilities - Miscellaneous (2999) ← catch-all for 2000–2999 unclassified

EQUITY (3000)
├── Owner's Capital (3100)
├── Retained Earnings (3200)
├── Current Year Earnings (3300)
└── Opening Balances Suspense (3999)

REVENUE (4000)
├── Product Sales (4100)
├── Sales Returns & Allowances (4110)
├── Service Revenue (4150)
├── Subscription Revenue (4200)
├── Interest & Investment Income (4300)
└── Other Income - Miscellaneous (4900) ← catch-all for 4000–4900 unclassified

EXPENSES (5000)
├── Cost of Sales (5100)
│   ├── Purchases (5110)
│   ├── Purchase Returns & Discounts (5120)
│   ├── Freight & Import Costs (5130)
│   └── Direct Labour (5140)
├── Salaries & Wages (5200)
│   ├── Admin & Management Salaries (5201)
│   ├── Sales & Distribution Wages (5202)
│   ├── Production & Operations Wages (5203)
│   └── Employer PAYE & Contributions (5210)
├── Rent & Lease (5300)
├── Utilities (5310)
├── Office Supplies (5320)
├── Marketing & Advertising (5330)
├── Travel & Transport (5340)
├── Depreciation Expense (5400)
├── Bank Charges & Interest (5500)
└── Other Expenses - Miscellaneous (5900) ← catch-all for 5000–5900 unclassified
```

> **Accounting Rule:** Catch-all accounts (`1999`, `2999`, `4900`, `5900`) are **contra-visibility accounts** — they are visible in reports but flagged as `requires_reclassification = true` so accountants are reminded to properly classify them later.

---

## Phase 2: Fetch & Group All Existing Accounts

**Step 2.1 — Fetch**

```bash
curl -X GET /api/chart-of-accounts \
  -H "Authorization: Bearer {SYSTEM_TOKEN}" \
  -H "X-Tenant-Id: {TENANT_ID}"
```

Repeat this for **every tenant** in the system. Store all results in a working dataset.

**Step 2.2 — Group by Account Type**

Using the account code ranges below, group every fetched account into one of five buckets. This must be done by **numeric code range**, not by the account's label, because labels may be inconsistent:

| Type | Code Range |
|------|------------|
| Asset | 1000–1999 |
| Liability | 2000–2999 |
| Equity | 3000–3999 |
| Revenue | 4000–4999 |
| Expense | 5000–5999 |

> **Accounting Rule:** If an account has a code outside all five ranges, flag it as `UNCLASSIFIED` and halt that tenant's migration pending manual review. Do **not** guess.

---

## Phase 3: Intelligent Account Merging (Per Type)

Within each type bucket, run semantic and code-proximity matching to determine which canonical account each existing account maps to.

### Merging Logic (apply in this order):

**Rule 1 — Exact Code Match**
If the existing account's code exactly matches a canonical code, map it directly. No merge needed.

**Rule 2 — Semantic Name Matching**
Use the following merge map as your ground truth. This is not exhaustive — use it as the pattern, then apply semantic reasoning for unlisted cases:

```
EXPENSES:
"Transport" | "Fuel" | "Vehicle Expenses" | "Car Allowance"
    → Travel & Transport (5340)

"Electricity" | "Water" | "Internet" | "Phone Bill" | "Airtime"
    → Utilities (5310)

"Stationery" | "Printing" | "Office Materials"
    → Office Supplies (5320)

"Advertising" | "Promotions" | "Social Media Ads" | "PR"
    → Marketing & Advertising (5330)

"Interest on Loan" | "Bank Fees" | "Wire Fees" | "Ledger Fees"
    → Bank Charges & Interest (5500)

"Amortization" | "Depreciation"
    → Depreciation Expense (5400)

"Staff Salaries" | "Wages" | "Payroll"
    → Salaries & Wages (5200) or appropriate sub-account

ASSETS:
"Cash in Hand" | "Till Float" | "Petty Float"
    → Cash - Petty Cash (1120)

"Debtors" | "Trade Debtors" | "Receivables"
    → Accounts Receivable (1200)

"Stock" | "Merchandise" | "Finished Goods"
    → Stock on Hand (1310)

LIABILITIES:
"Creditors" | "Trade Creditors" | "Payables"
    → Accounts Payable (2110)

"VAT Output" | "VAT Control" | "Tax Payable"
    → VAT Payable - MRA (2120)

REVENUE:
"Sales" | "Product Revenue" | "Goods Sold"
    → Product Sales (4100)

"Consulting" | "Professional Fees Earned" | "Service Fees"
    → Service Revenue (4150)
```

**Rule 3 — Code-Range Catch-All**
If an account cannot be semantically matched to any canonical account, map it to the catch-all for its type:

| Type | Catch-all Account |
|------|------------------|
| Asset | Other Assets - Miscellaneous (1999) |
| Liability | Other Liabilities - Miscellaneous (2999) |
| Revenue | Other Income - Miscellaneous (4900) |
| Expense | Other Expenses - Miscellaneous (5900) |
| Equity | Opening Balances Suspense (3999) — flag for manual review |

> **Accounting Rule:** Equity accounts must **never** be auto-merged without human confirmation. Flag all non-standard equity accounts and pause for approval before proceeding on that tenant.

---

## Phase 4: Account Balance & Transaction Migration

This is the most sensitive phase. Follow **double-entry accounting rules** strictly.

**For each account being merged/retired:**

### Step 4.1 — Calculate the Balance to Transfer

```
closing_balance = sum of all debits - sum of all credits on the retiring account
```

Confirm this matches the account's current ledger balance. If there is a discrepancy, **halt and log** — do not proceed.

### Step 4.2 — Post a Migration Journal Entry

Post a **system journal entry** (type: `MIGRATION`, not a normal business transaction) that:
- **Credits** the retiring account (bringing its balance to zero)
- **Debits** the target canonical account (moving the balance)
- Uses today's date, references `coa_migration_log` ID, and is flagged `auto_generated = true`

```
JOURNAL ENTRY FORMAT:
Date: {migration_date}
Reference: MIGRATE-{retiring_account_code}-TO-{canonical_code}
Type: SYSTEM_MIGRATION
Description: Account consolidation — {retiring_account_name} → {canonical_account_name}

DR  {canonical_account_code}  {canonical_account_name}   {balance}
CR  {retiring_account_code}   {retiring_account_name}    {balance}
```

> **Accounting Rule:** The migration journal entry must be balanced (debits = credits). If not, throw a hard error and rollback.

> **Accounting Rule:** For **contra accounts** (e.g., Accumulated Depreciation, Sales Returns), reverse the debit/credit direction accordingly.

### Step 4.3 — Remap All Transaction References

After posting the migration journal:
1. Update all **journal entry line items** that reference the retiring account code → point them to the canonical account code.
2. Update all **sub-ledger references** (AR aging, AP aging, inventory lots, payroll postings).
3. Update all **budget lines** referencing the old code.
4. Update all **report templates** referencing the old code.

### Step 4.4 — Retire the Old Account

Set the retiring account's status to `INACTIVE` with:
- `retired_at = now()`
- `migrated_to = {canonical_account_code}`
- `visible_in_ui = false`
- `accepts_new_transactions = false`

> **Do NOT delete the retiring account.** It must remain in the database for historical audit purposes.

---

## Phase 5: Multi-Tenant Propagation

Repeat Phases 2–4 for **every tenant** in the system:

- Process tenants **sequentially**, not in parallel, to avoid lock contention.
- Each tenant gets its own `coa_migration_log` entries.
- If a tenant's migration fails, log the error, skip that tenant, and continue with the next. Failed tenants must be reported in the final summary.
- After all tenants are processed, **lift the `coa_locked` flag** per tenant as each one completes successfully.

---

## Phase 6: Rebuild the /chart-of-accounts UI Section

After data migration is complete, re-implement the frontend `/chart-of-accounts` page with the following structure and behavior:

### Tree Display
Render the canonical CoA as a **collapsible tree**, matching the hierarchy in Phase 1. Each node must show:
- Account code
- Account name
- Current balance (for the active tenant)
- Type badge (Asset / Liability / Equity / Revenue / Expense)

### Catch-all Dropdowns
Accounts mapped to catch-all nodes (`1999`, `2999`, `4900`, `5900`) must appear as **expandable dropdown children** under their respective catch-all parent in the tree — exactly as indicated by `{As a dropdown}` in the source file.

### Account Status Indicators
- Canonical accounts: normal display
- Retired/migrated accounts: shown as greyed-out with a `Migrated → [new account]` tooltip, visible only in audit/history mode
- Catch-all accounts: show a yellow `⚠ Needs Reclassification` badge

### Restrictions
- Canonical accounts may not be deleted or have their codes changed by any user.
- Tenants may add **sub-accounts** under canonical parents (following the same code-range rules) but may not modify the canonical accounts themselves.
- Only system administrators may reclassify accounts sitting in catch-all groups.

---

## Phase 7: Validation & Reconciliation Report

After all tenants are migrated, generate a **Migration Reconciliation Report** that confirms:

1. **Balance sheet still balances:** Total Assets = Total Liabilities + Equity (per tenant, before and after)
2. **Income statement integrity:** Total Revenue – Total Expenses = Current Year Earnings (3300), matching pre-migration figure
3. **Zero orphaned transactions:** No journal line items reference a retired account code directly
4. **Row counts match:** Total transaction rows before = total transaction rows after (no data dropped)
5. **Audit log completeness:** Every retired account has a corresponding `coa_migration_log` entry

If any check fails, **raise a blocking alert** and do not mark the migration as complete.

---

## Hard Constraints & Accounting Standards Compliance

| Constraint | Standard |
|---|---|
| Double-entry must be maintained at all times | GAAP / IFRS |
| No account may be deleted — only retired | Audit trail requirements |
| Migration journals must be reversible | IFRS IAS 8 — correction of errors |
| Equity accounts require manual sign-off before migration | Internal control principle |
| All migration entries must be clearly labelled as system-generated | SOX compliance |
| Catch-all accounts must be flagged for reclassification | Proper period matching principle |
| Sub-ledger balances must reconcile to control accounts post-migration | GAAP reconciliation standards |
| No balance sheet equation may be broken at any point | Fundamental accounting equation: A = L + E |

---

## Deliverables

Upon completion, you must provide:

- [ ] Migration Reconciliation Report (per tenant)
- [ ] `coa_migration_log` export (CSV/JSON)
- [ ] List of accounts that landed in catch-all groups (requiring accountant reclassification)
- [ ] List of any tenants whose migration was skipped (with error reason)
- [ ] Confirmation that the `/chart-of-accounts` UI renders correctly with the canonical tree
- [ ] Rollback script (pre-generated, tested, ready to execute if needed)