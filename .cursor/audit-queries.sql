-- READ-ONLY forensic audit queries (Phase 1)
\echo '=== 1. Trial balance check per tenant (Transaction ledger) ==='
SELECT t."tenantId",
       COUNT(DISTINCT t.id) AS journals,
       SUM(tl."debitAmount") AS total_debits,
       SUM(tl."creditAmount") AS total_credits,
       SUM(tl."debitAmount") - SUM(tl."creditAmount") AS difference
FROM "Transaction" t
JOIN "TransactionLine" tl ON tl."transactionId" = t.id
WHERE lower(t.status) = 'posted'
GROUP BY t."tenantId";

\echo '=== 2. Per-journal unbalanced check (Transaction ledger) ==='
SELECT t.id, t."tenantId", t.reference, t."sourceType", t."sourceId", t.date, t.status,
       SUM(tl."debitAmount") AS dr, SUM(tl."creditAmount") AS cr,
       SUM(tl."debitAmount") - SUM(tl."creditAmount") AS diff
FROM "Transaction" t
JOIN "TransactionLine" tl ON tl."transactionId" = t.id
GROUP BY t.id
HAVING SUM(tl."debitAmount") <> SUM(tl."creditAmount");

\echo '=== 3. Journals with no lines / one line ==='
SELECT t.id, t."tenantId", t.reference, t."sourceType", t.status, COUNT(tl.id) AS line_count
FROM "Transaction" t
LEFT JOIN "TransactionLine" tl ON tl."transactionId" = t.id
GROUP BY t.id
HAVING COUNT(tl.id) < 2;

\echo '=== 4. JournalEntry (secondary ledger) integrity ==='
SELECT je.id, je."tenantId", je."referenceNumber", je."sourceType", je."sourceId", je.status, je."transactionId",
       je.debit AS legacy_debit, je.credit AS legacy_credit,
       COUNT(jel.id) AS line_count,
       COALESCE(SUM(jel."debitAmount"),0) AS dr, COALESCE(SUM(jel."creditAmount"),0) AS cr
FROM "JournalEntry" je
LEFT JOIN "JournalEntryLine" jel ON jel."journalEntryId" = je.id
GROUP BY je.id;

\echo '=== 5. Duplicate posted sources (Transaction) ==='
SELECT "tenantId", "sourceType", "sourceId", COUNT(*) AS postings
FROM "Transaction"
WHERE lower(status) = 'posted' AND "isReversal" = false
  AND "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL
GROUP BY "tenantId", "sourceType", "sourceId"
HAVING COUNT(*) > 1;

\echo '=== 6. Lines with both debit and credit, or neither ==='
SELECT tl.id, tl."transactionId", tl."accountId", tl."debitAmount", tl."creditAmount"
FROM "TransactionLine" tl
WHERE (tl."debitAmount" > 0 AND tl."creditAmount" > 0)
   OR (tl."debitAmount" = 0 AND tl."creditAmount" = 0)
   OR tl."debitAmount" < 0 OR tl."creditAmount" < 0;

\echo '=== 7. Stored Account.balance vs journal-derived balance (top diffs) ==='
WITH gl AS (
  SELECT a.id, a."tenantId", a."accountCode", a."accountName", a."accountType", a."normalBalance", a.balance AS stored,
    COALESCE((SELECT SUM(tl."debitAmount") FROM "TransactionLine" tl JOIN "Transaction" t ON t.id = tl."transactionId" WHERE tl."accountId" = a.id AND lower(t.status)='posted'),0)
    + COALESCE((SELECT SUM(jel."debitAmount") FROM "JournalEntryLine" jel JOIN "JournalEntry" je ON je.id = jel."journalEntryId" WHERE jel."accountId" = a.id AND lower(je.status)='posted'),0) AS dr,
    COALESCE((SELECT SUM(tl."creditAmount") FROM "TransactionLine" tl JOIN "Transaction" t ON t.id = tl."transactionId" WHERE tl."accountId" = a.id AND lower(t.status)='posted'),0)
    + COALESCE((SELECT SUM(jel."creditAmount") FROM "JournalEntryLine" jel JOIN "JournalEntry" je ON je.id = jel."journalEntryId" WHERE jel."accountId" = a.id AND lower(je.status)='posted'),0) AS cr
  FROM "Account" a
)
SELECT id, "tenantId", "accountCode", "accountName", "accountType", stored, dr, cr,
  CASE WHEN "accountType" IN ('Asset','Expense') OR "normalBalance"='Debit' THEN dr - cr ELSE cr - dr END AS derived,
  stored - (CASE WHEN "accountType" IN ('Asset','Expense') OR "normalBalance"='Debit' THEN dr - cr ELSE cr - dr END) AS diff
FROM gl
WHERE stored <> (CASE WHEN "accountType" IN ('Asset','Expense') OR "normalBalance"='Debit' THEN dr - cr ELSE cr - dr END)
ORDER BY ABS(stored - (CASE WHEN "accountType" IN ('Asset','Expense') OR "normalBalance"='Debit' THEN dr - cr ELSE cr - dr END)) DESC
LIMIT 40;

\echo '=== 8. Equity/capital accounts detail ==='
SELECT a.id, a."tenantId", a."accountCode", a."accountName", a."accountType", a."parentAccountId", a.balance,
       a."isActive", a."acceptsNewTransactions", a."visibleInChart"
FROM "Account" a
WHERE a."accountType" = 'Equity' OR a."accountName" ILIKE '%capital%'
ORDER BY a."tenantId", a."accountCode";

\echo '=== 9. Capital-related transaction lines ==='
SELECT t."tenantId", t.id AS txn_id, t.date, t.reference, t."sourceType", t."sourceId", t.status, t."isReversal",
       a."accountCode", a."accountName", tl."debitAmount", tl."creditAmount"
FROM "TransactionLine" tl
JOIN "Transaction" t ON t.id = tl."transactionId"
JOIN "Account" a ON a.id = tl."accountId"
WHERE a."accountType" = 'Equity' OR a."accountName" ILIKE '%capital%'
ORDER BY t."tenantId", t.date;

\echo '=== 10. Duplicate account codes per tenant ==='
SELECT "tenantId", "accountCode", COUNT(*), string_agg("accountName", ' | ')
FROM "Account"
WHERE "accountCode" IS NOT NULL
GROUP BY "tenantId", "accountCode"
HAVING COUNT(*) > 1;

\echo '=== 11. Accounts with NULL tenantId ==='
SELECT COUNT(*) FROM "Account" WHERE "tenantId" IS NULL;

\echo '=== 12. Posted transactions in closed periods ==='
SELECT t.id, t."tenantId", t.date, t.reference, t."sourceType", p.name AS period, p.status
FROM "Transaction" t
JOIN "AccountingPeriod" p ON p."tenantId" = t."tenantId"
  AND t.date >= p."startDate" AND t.date <= p."endDate" AND p."periodType" = 'Monthly'
WHERE p.status = 'closed' AND lower(t.status) = 'posted';

\echo '=== 13. Accounting periods inventory ==='
SELECT "tenantId", name, "periodType", "startDate"::date, "endDate"::date, status
FROM "AccountingPeriod" ORDER BY "tenantId", "startDate";

\echo '=== 14. Transactions with no period coverage ==='
SELECT t.id, t."tenantId", t.date::date, t.reference, t."sourceType"
FROM "Transaction" t
WHERE lower(t.status)='posted'
  AND NOT EXISTS (
    SELECT 1 FROM "AccountingPeriod" p
    WHERE p."tenantId" = t."tenantId" AND t.date >= p."startDate" AND t.date <= p."endDate"
  );

\echo '=== 15. Cross-tenant line references (account tenant <> txn tenant) ==='
SELECT tl.id, t."tenantId" AS txn_tenant, a."tenantId" AS acct_tenant, a."accountCode", a."accountName"
FROM "TransactionLine" tl
JOIN "Transaction" t ON t.id = tl."transactionId"
JOIN "Account" a ON a.id = tl."accountId"
WHERE a."tenantId" IS DISTINCT FROM t."tenantId";

\echo '=== 16. JournalEntryLine cross-tenant ==='
SELECT jel.id, je."tenantId" AS je_tenant, a."tenantId" AS acct_tenant, a."accountCode"
FROM "JournalEntryLine" jel
JOIN "JournalEntry" je ON je.id = jel."journalEntryId"
JOIN "Account" a ON a.id = jel."accountId"
WHERE a."tenantId" IS DISTINCT FROM je."tenantId";

\echo '=== 17. AR/AP control accounts and balances ==='
SELECT "tenantId", "accountCode", "accountName", "accountType", balance
FROM "Account"
WHERE "accountCode" IN ('1200','2000','2100') OR "accountName" ILIKE '%receivable%' OR "accountName" ILIKE '%payable%'
ORDER BY "tenantId", "accountCode";

\echo '=== 18. Invoice operational vs GL: invoices posted flag check ==='
SELECT i.id, i."tenantId", i."invoiceNumber", i.status, i.total, i."totalPaid", i."remainingBalance", i."isDeleted",
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = i.id) AS txn_count
FROM "Invoice" i;

\echo '=== 19. Sales vs GL ==='
SELECT s.id, s."tenantId", s."saleNumber", s.status, s.total,
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = s.id) AS txn_count
FROM "Sale" s;

\echo '=== 20. Expenses vs GL ==='
SELECT e.id, e."tenantId", e.description, e.status, e.amount, e."isDeleted",
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = e.id) AS txn_count
FROM "Expense" e;

\echo '=== 21. Payments vs GL ==='
SELECT p.id, p."tenantId", p.amount, p.status, p."invoiceId", p."saleId", p."expenseId",
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = p.id) AS txn_count
FROM "Payment" p;

\echo '=== 22. Supplier bills/payments vs GL ==='
SELECT sb.id, sb."tenantId", sb."billNumber", sb.status, sb."totalAmount", sb."journalEntryId",
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = sb.id) AS txn_count
FROM "SupplierBill" sb;
SELECT sp.id, sp."tenantId", sp."paymentNumber", sp."totalAmount", sp."journalEntryId",
  (SELECT COUNT(*) FROM "Transaction" t WHERE t."sourceId" = sp.id) AS txn_count
FROM "SupplierPayment" sp;

\echo '=== 23. Full transaction listing (small DB) ==='
SELECT t.id, t."tenantId", t.date::date, t.reference, t."sourceType", t."sourceId", t.status, t."entryType", t."isReversal",
       (SELECT SUM(tl."debitAmount") FROM "TransactionLine" tl WHERE tl."transactionId"=t.id) AS dr
FROM "Transaction" t ORDER BY t."tenantId", t.date;

\echo '=== 24. Duplicate JournalEntry referenceNumbers or duplicate source ==='
SELECT "tenantId", "sourceType", "sourceId", COUNT(*)
FROM "JournalEntry"
WHERE "sourceType" IS NOT NULL AND "sourceId" IS NOT NULL
GROUP BY "tenantId", "sourceType", "sourceId" HAVING COUNT(*) > 1;

\echo '=== 25. JournalEntry linked to Transaction (dual-ledger overlap) ==='
SELECT je.id, je."tenantId", je."referenceNumber", je."transactionId", je.status,
  (SELECT COUNT(*) FROM "JournalEntryLine" jel WHERE jel."journalEntryId"=je.id) AS lines
FROM "JournalEntry" je WHERE je."transactionId" IS NOT NULL;

\echo '=== 26. Parent accounts with direct postings ==='
SELECT a.id, a."tenantId", a."accountCode", a."accountName",
  (SELECT COUNT(*) FROM "Account" c WHERE c."parentAccountId" = a.id) AS children,
  (SELECT COUNT(*) FROM "TransactionLine" tl WHERE tl."accountId" = a.id) AS direct_txn_lines
FROM "Account" a
WHERE EXISTS (SELECT 1 FROM "Account" c WHERE c."parentAccountId" = a.id)
  AND EXISTS (SELECT 1 FROM "TransactionLine" tl WHERE tl."accountId" = a.id);

\echo '=== 27. Liability GL support check ==='
SELECT a."tenantId", a."accountCode", a."accountName", a.balance,
  COALESCE((SELECT SUM(tl."creditAmount"-tl."debitAmount") FROM "TransactionLine" tl JOIN "Transaction" t ON t.id=tl."transactionId" WHERE tl."accountId"=a.id AND lower(t.status)='posted'),0) AS journal_derived
FROM "Account" a
WHERE a."accountType" = 'Liability' AND a.balance <> 0;
