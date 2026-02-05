-- Migration: Add Reversal Fields to Transaction Models
-- Purpose: Enable accounting-safe transaction reversal without hard deletes

-- =============================================================================
-- REVERSAL FIELDS FOR TRANSACTION TABLE
-- =============================================================================
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for Transaction reversal queries
CREATE INDEX IF NOT EXISTS "Transaction_isReversal_idx" ON "Transaction"("isReversal");
CREATE INDEX IF NOT EXISTS "Transaction_reversedTransactionId_idx" ON "Transaction"("reversedTransactionId");

-- Constraint to prevent circular reversals (transaction cannot be reversed by its own reversal)
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_no_circular_reversal"
CHECK ("isReversal" = FALSE OR "reversedTransactionId" IS NOT NULL);

-- =============================================================================
-- REVERSAL FIELDS FOR INVOICE TABLE
-- =============================================================================
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for Invoice reversal queries
CREATE INDEX IF NOT EXISTS "Invoice_isReversal_idx" ON "Invoice"("isReversal");
CREATE INDEX IF NOT EXISTS "Invoice_reversedTransactionId_idx" ON "Invoice"("reversedTransactionId");

-- =============================================================================
-- REVERSAL FIELDS FOR EXPENSE TABLE
-- =============================================================================
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for Expense reversal queries
CREATE INDEX IF NOT EXISTS "Expense_isReversal_idx" ON "Expense"("isReversal");
CREATE INDEX IF NOT EXISTS "Expense_reversedTransactionId_idx" ON "Expense"("reversedTransactionId");

-- =============================================================================
-- REVERSAL FIELDS FOR PAYMENT TABLE
-- =============================================================================
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for Payment reversal queries
CREATE INDEX IF NOT EXISTS "Payment_isReversal_idx" ON "Payment"("isReversal");
CREATE INDEX IF NOT EXISTS "Payment_reversedTransactionId_idx" ON "Payment"("reversedTransactionId");

-- =============================================================================
-- REVERSAL FIELDS FOR SALE TABLE
-- =============================================================================
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for Sale reversal queries
CREATE INDEX IF NOT EXISTS "Sale_isReversal_idx" ON "Sale"("isReversal");
CREATE INDEX IF NOT EXISTS "Sale_reversedTransactionId_idx" ON "Sale"("reversedTransactionId");

-- =============================================================================
-- REVERSAL FIELDS FOR SUPPLIER_PAYMENT TABLE
-- =============================================================================
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

-- Indexes for SupplierPayment reversal queries
CREATE INDEX IF NOT EXISTS "SupplierPayment_isReversal_idx" ON "SupplierPayment"("isReversal");
CREATE INDEX IF NOT EXISTS "SupplierPayment_reversedTransactionId_idx" ON "SupplierPayment"("reversedTransactionId");

-- =============================================================================
-- REVERSAL AUDIT TABLE - For comprehensive audit trail
-- =============================================================================
CREATE TABLE IF NOT EXISTS "ReversalAudit" (
    "id" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "originalTransactionType" TEXT NOT NULL,
    "reversalTransactionId" TEXT NOT NULL,
    "reversalTransactionType" TEXT NOT NULL,
    "reversalReason" TEXT NOT NULL,
    "reversedById" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "reversalAmount" DOUBLE PRECISION NOT NULL,
    "tenantId" TEXT,
    "metadata" JSONB,
    
    CONSTRAINT "ReversalAudit_pkey" PRIMARY KEY ("id")
);

-- Indexes for ReversalAudit queries
CREATE INDEX IF NOT EXISTS "ReversalAudit_originalTransactionId_idx" ON "ReversalAudit"("originalTransactionId");
CREATE INDEX IF NOT EXISTS "ReversalAudit_reversalTransactionId_idx" ON "ReversalAudit"("reversalTransactionId");
CREATE INDEX IF NOT EXISTS "ReversalAudit_reversedById_idx" ON "ReversalAudit"("reversedById");
CREATE INDEX IF NOT EXISTS "ReversalAudit_reversedAt_idx" ON "ReversalAudit"("reversedAt");
CREATE INDEX IF NOT EXISTS "ReversalAudit_tenantId_idx" ON "ReversalAudit"("tenantId");

-- =============================================================================
-- TRIGGERS FOR PREVENTING DUPLICATE REVERSALS
-- =============================================================================
-- Create a function to check for duplicate reversals
CREATE OR REPLACE FUNCTION check_no_duplicate_reversal()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the original transaction has already been reversed
    IF EXISTS (
        SELECT 1 FROM "Transaction"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'Transaction % has already been reversed', NEW."reversedTransactionId";
    END IF;
    
    -- Check if the original transaction is itself a reversal
    IF EXISTS (
        SELECT 1 FROM "Transaction"
        WHERE "id" = NEW."reversedTransactionId" AND "reversedTransactionId" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Cannot reverse a transaction that is itself a reversal';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Transaction table
DROP TRIGGER IF EXISTS "Transaction_no_duplicate_reversal_trigger" ON "Transaction";
CREATE TRIGGER "Transaction_no_duplicate_reversal_trigger"
    BEFORE INSERT ON "Transaction"
    FOR EACH ROW
    WHEN (NEW."isReversal" = TRUE)
    EXECUTE FUNCTION check_no_duplicate_reversal();

-- Similarly for other tables, create triggers
CREATE OR REPLACE FUNCTION check_no_duplicate_invoice_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Invoice"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'Invoice % has already been reversed', NEW."reversedTransactionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_no_duplicate_expense_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Expense"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'Expense % has already been reversed', NEW."reversedTransactionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_no_duplicate_payment_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Payment"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'Payment % has already been reversed', NEW."reversedTransactionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_no_duplicate_sale_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Sale"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'Sale % has already been reversed', NEW."reversedTransactionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_no_duplicate_supplier_payment_reversal()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "SupplierPayment"
        WHERE "id" = NEW."reversedTransactionId" AND "isReversal" = TRUE
    ) THEN
        RAISE EXCEPTION 'SupplierPayment % has already been reversed', NEW."reversedTransactionId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION TO AUTOMATICALLY CREATE REVERSAL AUDIT ENTRY
-- =============================================================================
CREATE OR REPLACE FUNCTION create_reversal_audit_entry()
RETURNS TRIGGER AS $$
DECLARE
    audit_id TEXT;
BEGIN
    -- Generate unique ID for audit entry
    SELECT 'rev_audit_' || COALESCE(NEW."id", REPLACE(UUID_GENERATE_V4()::TEXT, '-', '_')) INTO audit_id;
    
    INSERT INTO "ReversalAudit" (
        "id",
        "originalTransactionId",
        "originalTransactionType",
        "reversalTransactionId",
        "reversalTransactionType",
        "reversalReason",
        "reversedById",
        "originalAmount",
        "reversalAmount",
        "tenantId"
    )
    SELECT 
        audit_id,
        OLD."id",
        'Transaction',
        NEW."id",
        'Transaction',
        NEW."reversalReason",
        NEW."reversedById",
        COALESCE(
            (SELECT SUM("debitAmount" - "creditAmount") FROM "TransactionLine" WHERE "transactionId" = OLD."id"),
            0
        ),
        COALESCE(
            (SELECT SUM("debitAmount" - "creditAmount") FROM "TransactionLine" WHERE "transactionId" = NEW."id"),
            0
        ),
        NEW."tenantId"
    WHERE NEW."isReversal" = TRUE AND NEW."reversedTransactionId" IS NOT NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create audit entry when reversal is created
DROP TRIGGER IF EXISTS "Transaction_reversal_audit_trigger" ON "Transaction";
CREATE TRIGGER "Transaction_reversal_audit_trigger"
    AFTER INSERT ON "Transaction"
    FOR EACH ROW
    WHEN (NEW."isReversal" = TRUE)
    EXECUTE FUNCTION create_reversal_audit_entry();

-- =============================================================================
-- ROLLBACK FUNCTION (for emergency use only)
-- =============================================================================
CREATE OR REPLACE FUNCTION rollback_reversal(p_original_id TEXT, p_reversal_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Mark reversal as no longer a reversal
    UPDATE "Transaction" SET 
        "isReversal" = FALSE,
        "reversedTransactionId" = NULL,
        "reversalReason" = NULL,
        "reversedAt" = NULL,
        "reversedById" = NULL
    WHERE "id" = p_reversal_id;
    
    -- Mark original as no longer reversed
    UPDATE "Transaction" SET 
        "isReversal" = FALSE,
        "reversedTransactionId" = NULL
    WHERE "id" = p_original_id;
    
    -- Remove audit entry
    DELETE FROM "ReversalAudit" 
    WHERE "originalTransactionId" = p_original_id 
    AND "reversalTransactionId" = p_reversal_id;
    
    RAISE NOTICE 'Reversal rolled back successfully for transaction %', p_original_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SUMMARY VIEW FOR REVERSALS
-- =============================================================================
CREATE OR REPLACE VIEW "ReversalSummary" AS
SELECT 
    ra."originalTransactionId",
    ra."originalTransactionType",
    ra."reversalTransactionId",
    ra."reversalTransactionType",
    ra."reversalReason",
    ra."reversedAt",
    ra."originalAmount",
    ra."reversalAmount",
    u."name" as "reversedByUser",
    ra."tenantId"
FROM "ReversalAudit" ra
LEFT JOIN "User" u ON ra."reversedById" = u."id";

-- Grant execute on rollback function to appropriate roles
-- COMMENT ON FUNCTION rollback_reversal(TEXT, TEXT) IS 'Emergency rollback function - use with caution';
