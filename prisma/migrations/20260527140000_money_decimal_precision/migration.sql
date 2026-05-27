-- Convert core monetary columns from double precision to DECIMAL(18,2).
-- Values are rounded half-up at migration time to preserve 2 dp storage.
-- Review on staging before production; backup database first.

-- Invoice
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" TYPE DECIMAL(18,2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "taxAmount" TYPE DECIMAL(18,2) USING ROUND("taxAmount"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "total" TYPE DECIMAL(18,2) USING ROUND("total"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "discount" TYPE DECIMAL(18,2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "originalTotal" TYPE DECIMAL(18,2) USING ROUND("originalTotal"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "refundAmount" TYPE DECIMAL(18,2) USING ROUND("refundAmount"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "remainingBalance" TYPE DECIMAL(18,2) USING ROUND("remainingBalance"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "totalDiscountAmount" TYPE DECIMAL(18,2) USING ROUND("totalDiscountAmount"::numeric, 2);
ALTER TABLE "Invoice" ALTER COLUMN "totalPaid" TYPE DECIMAL(18,2) USING ROUND("totalPaid"::numeric, 2);

-- InvoiceItem (money columns; quantity/taxRate remain float)
ALTER TABLE "InvoiceItem" ALTER COLUMN "unitPrice" TYPE DECIMAL(18,2) USING ROUND("unitPrice"::numeric, 2);
ALTER TABLE "InvoiceItem" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "InvoiceItem" ALTER COLUMN "discountAmount" TYPE DECIMAL(18,2) USING ROUND("discountAmount"::numeric, 2);
ALTER TABLE "InvoiceItem" ALTER COLUMN "netAmount" TYPE DECIMAL(18,2) USING ROUND("netAmount"::numeric, 2);

-- Sale
ALTER TABLE "Sale" ALTER COLUMN "subtotal" TYPE DECIMAL(18,2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "taxAmount" TYPE DECIMAL(18,2) USING ROUND("taxAmount"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "total" TYPE DECIMAL(18,2) USING ROUND("total"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "discount" TYPE DECIMAL(18,2) USING ROUND("discount"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "totalDiscountAmount" TYPE DECIMAL(18,2) USING ROUND("totalDiscountAmount"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "totalTaxAmount" TYPE DECIMAL(18,2) USING ROUND("totalTaxAmount"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "posAmountTendered" TYPE DECIMAL(18,2) USING ROUND("posAmountTendered"::numeric, 2);
ALTER TABLE "Sale" ALTER COLUMN "posChangeGiven" TYPE DECIMAL(18,2) USING ROUND("posChangeGiven"::numeric, 2);

-- SaleItem
ALTER TABLE "SaleItem" ALTER COLUMN "unitPrice" TYPE DECIMAL(18,2) USING ROUND("unitPrice"::numeric, 2);
ALTER TABLE "SaleItem" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "SaleItem" ALTER COLUMN "discountAmount" TYPE DECIMAL(18,2) USING ROUND("discountAmount"::numeric, 2);
ALTER TABLE "SaleItem" ALTER COLUMN "taxAmount" TYPE DECIMAL(18,2) USING ROUND("taxAmount"::numeric, 2);

-- Expense
ALTER TABLE "Expense" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Expense" ALTER COLUMN "taxAmount" TYPE DECIMAL(18,2) USING ROUND("taxAmount"::numeric, 2);
ALTER TABLE "Expense" ALTER COLUMN "paidAmount" TYPE DECIMAL(18,2) USING ROUND("paidAmount"::numeric, 2);

-- Payment
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);

-- JournalEntryLine / TransactionLine
ALTER TABLE "JournalEntryLine" ALTER COLUMN "debitAmount" TYPE DECIMAL(18,2) USING ROUND("debitAmount"::numeric, 2);
ALTER TABLE "JournalEntryLine" ALTER COLUMN "creditAmount" TYPE DECIMAL(18,2) USING ROUND("creditAmount"::numeric, 2);
ALTER TABLE "TransactionLine" ALTER COLUMN "debitAmount" TYPE DECIMAL(18,2) USING ROUND("debitAmount"::numeric, 2);
ALTER TABLE "TransactionLine" ALTER COLUMN "creditAmount" TYPE DECIMAL(18,2) USING ROUND("creditAmount"::numeric, 2);

-- SupplierBill
ALTER TABLE "SupplierBill" ALTER COLUMN "subtotal" TYPE DECIMAL(18,2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "SupplierBill" ALTER COLUMN "taxAmount" TYPE DECIMAL(18,2) USING ROUND("taxAmount"::numeric, 2);
ALTER TABLE "SupplierBill" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING ROUND("totalAmount"::numeric, 2);
ALTER TABLE "SupplierBill" ALTER COLUMN "amountPaid" TYPE DECIMAL(18,2) USING ROUND("amountPaid"::numeric, 2);

-- Account balance
ALTER TABLE "Account" ALTER COLUMN "balance" TYPE DECIMAL(18,2) USING ROUND("balance"::numeric, 2);
