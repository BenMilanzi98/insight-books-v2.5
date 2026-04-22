# AI Developer Prompt: Chart of Accounts Implementation
## Comprehensive Guide for Implementing 5 Main Accounts with Full Hierarchy

---

## EXECUTIVE SUMMARY

You are tasked with implementing a comprehensive Chart of Accounts (CoA) system in /chart-of-accounts. This system must follow double-entry bookkeeping principles and ensure all financial transactions post to the correct accounts. The implementation must preserve existing system functionality while establishing a proper accounting foundation for accurate financial reporting.

**Critical Objective:** Implement 5 main account categories (Assets, Liabilities, Equity, Revenue, Expenses) with all their child accounts, ensuring every transaction in the system flows through the correct accounts without breaking existing features.

---

## PART 1: UNDERSTANDING THE ACCOUNTING ARCHITECTURE

### 1.1 How Chart of Accounts Works

The system must use a **hierarchical, multi-level Chart of Accounts** structured as follows:

```
Main Account (Level 1)
├── Sub-Category/Group (Level 2)
│   ├── Account (Level 3)
│   │   └── Sub-Account (Level 4 - Optional)
```

**Example Structure:**
```
Assets (1000) - Main Account
├── Current Assets (1100) - Group
│   ├── Cash - Main Account (1110) - Account
│   │   └── [No sub-accounts]
│   ├── Bank - Primary (1130) - Account
│   │   ├── National Bank (1130-01) - Sub-Account
│   │   └── Standard Bank (1130-02) - Sub-Account
│   ├── Accounts Receivable (1200) - Account
│   └── Prepaid Expenses (1210) - Account
├── Fixed Assets (1500) - Group
│   ├── Property & Equipment (1510)
│   ├── Furniture & Fittings (1520)
│   ├── Motor Vehicles (1530)
│   ├── Computer Equipment (1540)
│   └── Accumulated Depreciation (1590)
└── Other Assets (1900) - Group
    ├── Long-term Deposits (1910)
    └── Intangible Assets (1920)
```

### 1.2 Account Types in System

The system recognizes the following account types:

- **Asset:** Represents resources owned by the business (debit balance normal)
- **Liability:** Represents obligations to external parties (credit balance normal)
- **Equity:** Represents owner's stake in the business (credit balance normal)
- **Revenue:** Represents income earned (credit balance normal)
- **Expense:** Represents costs incurred (debit balance normal)
- **Subtotal/Group:** Used for grouping and reporting, does not directly receive postings

### 1.3 Account Code Structure in System

System uses a hierarchical numeric coding system:

```
1000-1999: Assets
  1100-1199: Current Assets
    1110: Cash - Main Account
    1120: Cash - Petty Cash
    1130: Bank - Primary
      1130-01: National Bank (sub-account)
      1130-02: Standard Bank (sub-account)
    1200: Accounts Receivable
    1210: Prepaid Expenses
    1215: Advances to Suppliers
  1300-1399: Inventory
    1310: Stock on Hand
    1320: Raw Materials
    1330: Goods in Transit
  1500-1599: Fixed Assets
    1510: Property & Equipment
    1520: Furniture & Fittings
    1530: Motor Vehicles
    1540: Computer Equipment
    1590: Accumulated Depreciation
  1900-1999: Other Assets
    1910: Long-term Deposits
    1920: Intangible Assets

2000-2999: Liabilities
  2100-2199: Current Liabilities
    2110: Accounts Payable
    2120: VAT Payable (MRA)
    2130: PAYE Payable
    2140: Accrued Expenses
    2150: Deferred Revenue
    2160: Short-term Loans
  2500-2599: Long-term Liabilities
    2510: Bank Loans (Long-term)
    2520: Shareholder Loans

3000-3999: Equity
  3100: Owner's Capital
  3200: Retained Earnings
  3300: Current Year Earnings
  3999: Opening Balances Suspense (system)

4000-4999: Revenue
  4100: Product Sales
  4110: Sales Returns & Allowances
  4150: Service Revenue
  4200: Subscription Revenue
  4300: Interest & Investment Income
  4900: Other Income

5000-5999: Expenses
  5100-5199: Cost of Sales
    5110: Purchases
    5120: Purchase Returns & Discounts
    5130: Freight & Import Costs
    5140: Direct Labour
  5200-5299: Salaries & Wages
    5201: Admin & Management Salaries
    5202: Sales & Distribution Wages
    5203: Production & Operations Wages
    5210: Employer PAYE & Contributions
  5300-5399: Operating Expenses
    5300: Rent & Lease
    5310: Utilities
    5320: Office Supplies
    5330: Marketing & Advertising
    5340: Travel & Transport
  5400-5499: Depreciation
    5400: Depreciation Expense
  5500-5599: Financial Expenses
    5500: Bank Charges & Interest
  5900-5999: Other Expenses
    5900: Other Expenses
```

### 1.4 System Account vs Standard Account

**System Accounts** (marked with "system" flag):
- Automatically created and managed by the system
- Used for core business transactions
- Examples: Cash - Main Account, Bank - Primary, Accounts Payable, Product Sales, Admin Salaries
- Should NOT be deleted or modified by users
- System automatically posts transactions to these accounts

**Standard Accounts**:
- Created by users for specific business needs
- Can be modified or deleted (with caution)
- Examples: Prepaid Expenses, Advances to Suppliers, Other Income
- Users can manually post journal entries to these accounts

---

## PART 2: HOW MONEY FLOWS THROUGH THE SYSTEM SYSTEM

### 2.1 Sales Transaction Flow

**When a customer invoice is created:**

```
Customer Invoice (Sales/Invoices/Create)
├── Debit: Accounts Receivable (1200) - Amount
├── Credit: Product Sales (4100) - Amount (for products)
├── Credit: Service Revenue (4150) - Amount (for services)
└── Credit: VAT Payable (2120) - Tax Amount (if applicable)
```

**When payment is received from customer:**

```
Payment Received
├── Debit: Cash (1110) or Bank (1130) - Amount
└── Credit: Accounts Receivable (1200) - Amount
```

**When sales return/credit note is issued:**

```
Credit Note
├── Debit: Sales Returns & Allowances (4110) - Amount
└── Credit: Accounts Receivable (1200) - Amount
```

### 2.2 Purchase Transaction Flow

**When a vendor bill is created:**

```
Vendor Bill (Purchases/Bills/Create)
├── Debit: Purchases (5110) - Amount (for goods)
├── Debit: Freight & Import Costs (5130) - Amount (if applicable)
├── Credit: Accounts Payable (2110) - Amount
└── Credit: VAT Payable (2120) - Tax Amount (if applicable)
```

**When payment is made to vendor:**

```
Payment Made
├── Debit: Accounts Payable (2110) - Amount
└── Credit: Cash (1110) or Bank (1130) - Amount
```

**When purchase return/debit note is issued:**

```
Debit Note
├── Debit: Accounts Payable (2110) - Amount
└── Credit: Purchase Returns & Discounts (5120) - Amount
```

### 2.3 Inventory Transaction Flow

**When stock is received (from purchase):**

```
Stock Receipt
├── Debit: Inventory (1300) or Stock on Hand (1310) - Cost Amount
└── Credit: Accounts Payable (2110) - Cost Amount
```

**When stock is transferred between locations:**

```
Stock Transfer
├── Debit: Stock on Hand - Location B (1310) - Cost Amount
└── Credit: Stock on Hand - Location A (1310) - Cost Amount
```

**When stock is adjusted (physical count vs system):**

```
Stock Adjustment (Increase)
├── Debit: Stock on Hand (1310) - Adjustment Amount
└── Credit: Other Income (4900) - Adjustment Amount

Stock Adjustment (Decrease)
├── Debit: Other Expenses (5900) - Adjustment Amount
└── Credit: Stock on Hand (1310) - Adjustment Amount
```

### 2.4 POS Terminal Transaction Flow

**When a sale is completed at POS:**

```
POS Sale (Cash Sale)
├── Debit: Cash (1110) - Total Amount
├── Credit: Product Sales (4100) - Sale Amount
├── Credit: VAT Payable (2120) - Tax Amount (if applicable)
└── Debit: Stock on Hand (1310) - Cost of Goods Sold Amount
    └── Credit: Cost of Sales (5100) or COGS Account - Cost Amount
```

### 2.5 Expense Transaction Flow

**When an expense is recorded:**

```
Expense Entry (e.g., Rent Payment)
├── Debit: Rent & Lease (5300) - Amount
└── Credit: Cash (1110) or Bank (1130) - Amount
```

**When salary is paid:**

```
Salary Payment
├── Debit: Admin & Management Salaries (5201) or appropriate wage account - Gross Amount
├── Credit: PAYE Payable (2130) - Tax Amount
├── Credit: Cash (1110) or Bank (1130) - Net Amount
```

### 2.6 Journal Entry Flow

**When a manual journal entry is posted:**

```
Journal Entry (Double-Entry Principle)
├── Debit Account(s) - Total Debit Amount
└── Credit Account(s) - Total Credit Amount
(Must balance: Total Debits = Total Credits)
```

---

## PART 3: IMPLEMENTATION REQUIREMENTS

### 3.1 Database Schema Updates

**Create/Update the following tables:**

1. **chart_of_accounts** table
   ```sql
   CREATE TABLE chart_of_accounts (
     id INT PRIMARY KEY AUTO_INCREMENT,
     code VARCHAR(20) UNIQUE NOT NULL,
     name VARCHAR(255) NOT NULL,
     type ENUM('Asset', 'Liability', 'Equity', 'Revenue', 'Expense', 'Subtotal') NOT NULL,
     category VARCHAR(100),
     parent_id INT,
     is_system_account BOOLEAN DEFAULT FALSE,
     is_active BOOLEAN DEFAULT TRUE,
     normal_balance ENUM('Debit', 'Credit') NOT NULL,
     description TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (parent_id) REFERENCES chart_of_accounts(id),
     INDEX (code),
     INDEX (type),
     INDEX (parent_id)
   );
   ```

2. **journal_entries** table (for posting transactions)
   ```sql
   CREATE TABLE journal_entries (
     id INT PRIMARY KEY AUTO_INCREMENT,
     entry_date DATE NOT NULL,
     description VARCHAR(500),
     reference_type VARCHAR(50),
     reference_id INT,
     posted_by_user_id INT,
     is_posted BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (posted_by_user_id) REFERENCES users(id),
     INDEX (entry_date),
     INDEX (reference_type)
   );
   ```

3. **journal_entry_lines** table (individual debit/credit lines)
   ```sql
   CREATE TABLE journal_entry_lines (
     id INT PRIMARY KEY AUTO_INCREMENT,
     journal_entry_id INT NOT NULL,
     account_id INT NOT NULL,
     debit_amount DECIMAL(15, 2) DEFAULT 0,
     credit_amount DECIMAL(15, 2) DEFAULT 0,
     description VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
     FOREIGN KEY (account_id) REFERENCES chart_of_accounts(id),
     INDEX (account_id),
     CHECK (debit_amount >= 0 AND credit_amount >= 0),
     CHECK (NOT (debit_amount > 0 AND credit_amount > 0))
   );
   ```

### 3.2 Data Migration Strategy

**CRITICAL:** Preserve existing system data while implementing new CoA structure.

**Step 1: Create New Chart of Accounts**
- Insert all 5 main accounts and their children as defined in the hierarchy
- Mark system accounts appropriately
- Set normal balance for each account type

**Step 2: Map Existing Accounts**
- Review all existing accounts currently in the system
- Map them to appropriate main accounts or child accounts
- Create new child accounts if needed to accommodate existing data
- Do NOT delete existing accounts; instead, mark them as inactive if they don't fit

**Step 3: Migrate Historical Data**
- For each existing transaction (invoice, bill, payment, etc.):
  - Identify the original account it was posted to
  - Determine the correct account in the new CoA structure
  - Create journal entries to move balances to correct accounts
  - Maintain audit trail of migration

**Step 4: Validation**
- Verify total debits = total credits for all periods
- Confirm account balances match before and after migration
- Test all transaction flows with new CoA

### 3.3 Implementation Checklist

**Phase 1: Database & Schema**
- [ ] Create chart_of_accounts table with all required fields
- [ ] Create journal_entries and journal_entry_lines tables
- [ ] Create indexes for performance
- [ ] Add foreign key relationships
- [ ] Create migration scripts

**Phase 2: Chart of Accounts Setup**
- [ ] Seed 5 main accounts (Assets, Liabilities, Equity, Revenue, Expenses)
- [ ] Seed all 65 child accounts with correct codes and types
- [ ] Set normal balance for each account
- [ ] Mark system accounts
- [ ] Set parent-child relationships

**Phase 3: Existing Data Migration**
- [ ] Map existing accounts to new CoA
- [ ] Create migration journal entries
- [ ] Validate data integrity
- [ ] Generate reconciliation report

**Phase 4: Transaction Posting Logic**
- [ ] Update Invoice creation to post to correct accounts
- [ ] Update Bill creation to post to correct accounts
- [ ] Update Payment processing to post to correct accounts
- [ ] Update POS Terminal to post to correct accounts
- [ ] Update Stock movements to post to correct accounts
- [ ] Update Expense entries to post to correct accounts

**Phase 5: Reporting & Validation**
- [ ] Implement Trial Balance report
- [ ] Implement Balance Sheet report
- [ ] Implement Profit & Loss report
- [ ] Implement Cash Flow report
- [ ] Create account reconciliation reports
- [ ] Test all reports with sample data

**Phase 6: Testing & QA**
- [ ] Test complete sales transaction flow
- [ ] Test complete purchase transaction flow
- [ ] Test payment processing
- [ ] Test stock movements
- [ ] Test manual journal entries
- [ ] Verify all reports balance
- [ ] Test with existing user data

---

## PART 4: TRANSACTION POSTING RULES

### 4.1 Golden Rules of Double-Entry Bookkeeping

1. **Every transaction has two sides:** Debit and Credit
2. **Debits must equal Credits:** Total debits = Total credits for each entry
3. **Assets increase with Debits, decrease with Credits**
4. **Liabilities increase with Credits, decrease with Debits**
5. **Equity increases with Credits, decreases with Debits**
6. **Revenue increases with Credits, decreases with Debits**
7. **Expenses increase with Debits, decrease with Credits**

### 4.2 Account Posting Rules by Type

**ASSETS (Normal Balance: Debit)**
- Increase: Debit the account
- Decrease: Credit the account
- Example: Debit Cash when received, Credit Cash when paid out

**LIABILITIES (Normal Balance: Credit)**
- Increase: Credit the account
- Decrease: Debit the account
- Example: Credit Accounts Payable when bill received, Debit when paid

**EQUITY (Normal Balance: Credit)**
- Increase: Credit the account
- Decrease: Debit the account
- Example: Credit Owner's Capital when invested, Debit when withdrawn

**REVENUE (Normal Balance: Credit)**
- Increase: Credit the account
- Decrease: Debit the account (via returns)
- Example: Credit Product Sales when invoice created, Debit Sales Returns when credit note issued

**EXPENSES (Normal Balance: Debit)**
- Increase: Debit the account
- Decrease: Credit the account (via returns)
- Example: Debit Rent when paid, Credit when adjustment made

### 4.3 Specific Transaction Posting Rules

**SALES INVOICE CREATION:**
```
Debit: Accounts Receivable (1200) - Full invoice amount
Credit: Product Sales (4100) - Product amount
Credit: Service Revenue (4150) - Service amount
Credit: VAT Payable (2120) - Tax amount (if applicable)
```

**SALES PAYMENT RECEIVED:**
```
Debit: Cash (1110) or Bank (1130) - Payment amount
Credit: Accounts Receivable (1200) - Payment amount
```

**PURCHASE BILL CREATION:**
```
Debit: Purchases (5110) - Product cost
Debit: Freight & Import Costs (5130) - Freight (if applicable)
Credit: Accounts Payable (2110) - Full bill amount
Credit: VAT Payable (2120) - Tax amount (if applicable)
```

**PURCHASE PAYMENT MADE:**
```
Debit: Accounts Payable (2110) - Payment amount
Credit: Cash (1110) or Bank (1130) - Payment amount
```

**STOCK RECEIPT (from purchase):**
```
Debit: Stock on Hand (1310) - Cost value
Credit: Accounts Payable (2110) - Cost value
```

**POS SALE (Cash):**
```
Debit: Cash (1110) - Total sale amount
Credit: Product Sales (4100) - Sale amount
Credit: VAT Payable (2120) - Tax amount (if applicable)

AND

Debit: Cost of Sales (5100) or COGS - Cost of goods
Credit: Stock on Hand (1310) - Cost of goods
```

**EXPENSE PAYMENT:**
```
Debit: Expense Account (e.g., Rent & Lease 5300) - Amount
Credit: Cash (1110) or Bank (1130) - Amount
```

---

## PART 5: CRITICAL IMPLEMENTATION GUIDELINES

### 5.1 DO's (Best Practices)

✅ **DO:**
- Implement double-entry bookkeeping for ALL transactions
- Validate that debits equal credits before posting any journal entry
- Use system accounts for automatic postings (invoices, bills, payments)
- Create child accounts for detailed tracking (e.g., Bank by institution)
- Maintain audit trail of all postings with user and timestamp
- Test all transaction flows thoroughly before deployment
- Preserve existing account balances during migration
- Document all account mappings for audit purposes
- Use transaction IDs to link journal entries to source documents
- Implement proper error handling and rollback for failed postings

### 5.2 DON'Ts (Critical Warnings)

❌ **DON'T:**
- Post to subtotal/group accounts directly (only use for reporting)
- Create journal entries that don't balance
- Delete existing accounts (mark as inactive instead)
- Modify system account definitions
- Post transactions without proper authorization
- Bypass the journal entry posting process
- Mix old and new account structures in transactions
- Forget to update all transaction types (invoices, bills, POS, etc.)
- Ignore tax implications (VAT, PAYE, etc.)
- Post to wrong account types (e.g., expense to revenue account)

### 5.3 Data Integrity Requirements

- **Referential Integrity:** All foreign keys must be valid
- **Balance Integrity:** Trial balance must always balance
- **Account Integrity:** No orphaned accounts or transactions
- **Audit Trail:** All postings must be traceable to source
- **Period Integrity:** Transactions must be in correct fiscal period
- **Tax Integrity:** Tax calculations must be accurate and posted correctly

---

## PART 6: IMPLEMENTATION WORKFLOW

### Step 1: Database Schema Creation
1. Create chart_of_accounts table
2. Create journal_entries and journal_entry_lines tables
3. Create necessary indexes
4. Run migrations

### Step 2: Chart of Accounts Initialization
1. Insert 5 main accounts
2. Insert all 65 child accounts with codes
3. Set account types and normal balances
4. Mark system accounts
5. Verify all accounts are created correctly

### Step 3: Transaction Posting Logic
1. Update Invoice module to post to correct accounts
2. Update Bill module to post to correct accounts
3. Update Payment module to post to correct accounts
4. Update POS module to post to correct accounts
5. Update Stock module to post to correct accounts
6. Update Expense module to post to correct accounts

### Step 4: Data Migration
1. Analyze existing transactions
2. Create mapping rules
3. Generate migration journal entries
4. Execute migration with validation
5. Reconcile balances

### Step 5: Reporting Implementation
1. Implement Trial Balance report
2. Implement Balance Sheet report
3. Implement Profit & Loss report
4. Implement Cash Flow report
5. Test all reports

### Step 6: Testing & Validation
1. Create test transactions for each type
2. Verify postings are correct
3. Verify reports balance
4. Test with existing user data
5. Perform UAT with business users

---

## PART 7: ACCOUNT HIERARCHY REFERENCE

### 5 Main Accounts Structure

```
1. ASSETS (1000)
   ├── Current Assets (1100)
   │   ├── Cash - Main Account (1110) [System]
   │   ├── Cash - Petty Cash (1120)
   │   ├── Bank - Primary (1130) [System]
   │   │   ├── National Bank (1130-01)
   │   │   └── Standard Bank (1130-02)
   │   ├── Accounts Receivable (1200) [System]
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
       └── Intangible Assets (1920)

2. LIABILITIES (2000)
   ├── Current Liabilities (2100)
   │   ├── Accounts Payable (2110) [System]
   │   ├── VAT Payable (MRA) (2120)
   │   ├── PAYE Payable (2130)
   │   ├── Accrued Expenses (2140)
   │   ├── Deferred Revenue (2150)
   │   └── Short-term Loans (2160)
   └── Long-term Liabilities (2500)
       ├── Bank Loans (Long-term) (2510)
       └── Shareholder Loans (2520)

3. EQUITY (3000)
   ├── Owner's Capital (3100)
   ├── Retained Earnings (3200)
   ├── Current Year Earnings (3300)
   └── Opening Balances Suspense (3999) [System]

4. REVENUE (4000)
   ├── Product Sales (4100) [System]
   ├── Sales Returns & Allowances (4110)
   ├── Service Revenue (4150)
   ├── Subscription Revenue (4200)
   ├── Interest & Investment Income (4300)
   └── Other Income (4900)

5. EXPENSES (5000)
   ├── Cost of Sales (5100)
   │   ├── Purchases (5110)
   │   ├── Purchase Returns & Discounts (5120)
   │   ├── Freight & Import Costs (5130)
   │   └── Direct Labour (5140)
   ├── Salaries & Wages (5200)
   │   ├── Admin & Management Salaries (5201) [System]
   │   ├── Sales & Distribution Wages (5202)
   │   ├── Production & Operations Wages (5203)
   │   └── Employer PAYE & Contributions (5210)
   ├── Operating Expenses (5300+)
   │   ├── Rent & Lease (5300)
   │   ├── Utilities (5310)
   │   ├── Office Supplies (5320)
   │   ├── Marketing & Advertising (5330)
   │   ├── Travel & Transport (5340)
   │   ├── Depreciation Expense (5400)
   │   ├── Bank Charges & Interest (5500)
   │   └── Other Expenses (5900)
```

---

## PART 8: VALIDATION CHECKLIST

Before marking implementation complete, verify:

- [ ] All 5 main accounts exist with correct codes
- [ ] All 65 child accounts exist with correct parent relationships
- [ ] All account types are correctly set
- [ ] All normal balances are correct
- [ ] System accounts are marked appropriately
- [ ] All existing transactions are mapped to new accounts
- [ ] Trial balance balances (Total Debits = Total Credits)
- [ ] All account balances are correct after migration
- [ ] Sales invoices post to correct accounts
- [ ] Purchase bills post to correct accounts
- [ ] Payments post to correct accounts
- [ ] POS sales post to correct accounts
- [ ] Stock movements post to correct accounts
- [ ] Expenses post to correct accounts
- [ ] Manual journal entries validate and balance
- [ ] Trial Balance report is accurate
- [ ] Balance Sheet report is accurate
- [ ] Profit & Loss report is accurate
- [ ] Cash Flow report is accurate
- [ ] No orphaned transactions or accounts
- [ ] Audit trail is complete for all postings
- [ ] User permissions are respected
- [ ] System performance is acceptable

---

## PART 9: SUPPORT & TROUBLESHOOTING

### Common Issues & Solutions

**Issue: Trial Balance doesn't balance**
- Solution: Check for unposted journal entries, verify all transactions have both debit and credit, check for data migration errors

**Issue: Account balance is incorrect**
- Solution: Verify all transactions posting to that account, check for duplicate postings, review migration journal entries

**Issue: Transactions not posting to correct account**
- Solution: Verify transaction posting logic, check account mapping, ensure system account is configured correctly

**Issue: Existing user data is lost**
- Solution: Restore from backup, review migration process, verify data mapping rules

---

## CONCLUSION

This implementation will establish a robust, compliant accounting foundation for the System system. By following these guidelines, you will ensure:

1. **Accuracy:** All transactions post to correct accounts
2. **Compliance:** Double-entry bookkeeping principles are maintained
3. **Integrity:** Data is preserved and traceable
4. **Reporting:** Financial statements are accurate and reliable
5. **Scalability:** System can handle growing transaction volumes

The Chart of Accounts is the backbone of any accounting system. Implement it correctly, and the entire system will function reliably. Implement it incorrectly, and all financial reports will be unreliable.

**Remember:** When in doubt, consult the double-entry bookkeeping principles and the transaction flow diagrams provided in this document.

---