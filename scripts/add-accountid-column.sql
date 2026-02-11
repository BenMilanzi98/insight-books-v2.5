-- SQL script to add accountId column to SaleItem table
-- Run this script on your database to fix the "Income account is required" error

-- Step 1: Check if column already exists and get default account
DO $$
DECLARE
    default_account_id TEXT;
    null_count INTEGER;
BEGIN
    -- Check if column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'SaleItem' AND column_name = 'accountId'
    ) THEN
        RAISE NOTICE 'Column accountId already exists in SaleItem table';
        
        -- Check for NULL values
        EXECUTE 'SELECT COUNT(*) FROM "SaleItem" WHERE "accountId" IS NULL' INTO null_count;
        
        IF null_count > 0 THEN
            RAISE NOTICE 'Found % rows with NULL accountId', null_count;
            
            -- Get default income account
            SELECT id INTO default_account_id
            FROM "Account"
            WHERE "accountType" IN ('Income', 'Revenue')
            AND "isActive" = true
            ORDER BY "accountCode" ASC
            LIMIT 1;
            
            IF default_account_id IS NULL THEN
                RAISE EXCEPTION 'No active Income or Revenue account found. Please create one in Chart of Accounts first.';
            END IF;
            
            -- Update NULL values
            EXECUTE format('UPDATE "SaleItem" SET "accountId" = %L WHERE "accountId" IS NULL', default_account_id);
            RAISE NOTICE 'Updated % rows with default account', null_count;
        END IF;
        
        -- Make column NOT NULL
        ALTER TABLE "SaleItem" ALTER COLUMN "accountId" SET NOT NULL;
        RAISE NOTICE 'Column accountId is now required';
    ELSE
        RAISE NOTICE 'Adding accountId column to SaleItem table...';
        
        -- Step 2: Add column as nullable first
        ALTER TABLE "SaleItem" ADD COLUMN "accountId" TEXT;
        
        -- Step 3: Get default income account
        SELECT id INTO default_account_id
        FROM "Account"
        WHERE "accountType" IN ('Income', 'Revenue')
        AND "isActive" = true
        ORDER BY "accountCode" ASC
        LIMIT 1;
        
        IF default_account_id IS NULL THEN
            RAISE EXCEPTION 'No active Income or Revenue account found. Please create one in Chart of Accounts first.';
        END IF;
        
        RAISE NOTICE 'Using default account: %', default_account_id;
        
        -- Step 4: Set default value for existing rows
        EXECUTE format('UPDATE "SaleItem" SET "accountId" = %L WHERE "accountId" IS NULL', default_account_id);
        RAISE NOTICE 'Updated existing rows with default account';
        
        -- Step 5: Add foreign key constraint
        ALTER TABLE "SaleItem" 
        ADD CONSTRAINT "SaleItem_accountId_fkey" 
        FOREIGN KEY ("accountId") 
        REFERENCES "Account"("id");
        RAISE NOTICE 'Foreign key constraint added';
        
        -- Step 6: Make column NOT NULL
        ALTER TABLE "SaleItem" ALTER COLUMN "accountId" SET NOT NULL;
        RAISE NOTICE 'Column accountId is now required';
        
        -- Step 7: Create index
        CREATE INDEX IF NOT EXISTS "SaleItem_accountId_idx" ON "SaleItem"("accountId");
        RAISE NOTICE 'Index created';
    END IF;
END $$;
