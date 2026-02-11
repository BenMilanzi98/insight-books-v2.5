/**
 * Migration script to add accountId to SaleItem table
 * This script:
 * 1. Adds accountId column as nullable
 * 2. Sets a default account for existing rows
 * 3. Makes the column required
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('\n🔄 Starting migration: Add accountId to SaleItem...\n');

    // Step 1: Check if column already exists
    const columnExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'SaleItem' 
      AND column_name = 'accountId'
    `;

    if (columnExists && columnExists.length > 0) {
      console.log('✅ accountId column already exists in SaleItem table');
      
      // Check if there are any NULL values
      const nullCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM "SaleItem" 
        WHERE "accountId" IS NULL
      `;
      
      if (nullCount[0].count > 0) {
        console.log(`⚠️  Found ${nullCount[0].count} rows with NULL accountId`);
        console.log('   Setting default account for existing rows...');
        
        // Get a default income account
        const defaultAccount = await prisma.account.findFirst({
          where: {
            accountType: { in: ['Income', 'Revenue'] },
            isActive: true
          },
          orderBy: { accountCode: 'asc' }
        });

        if (!defaultAccount) {
          throw new Error('No active Income or Revenue account found. Please create one in Chart of Accounts first.');
        }

        console.log(`   Using default account: ${defaultAccount.accountCode} - ${defaultAccount.accountName}`);

        // Update NULL values
        await prisma.$executeRaw`
          UPDATE "SaleItem" 
          SET "accountId" = ${defaultAccount.id}
          WHERE "accountId" IS NULL
        `;

        console.log(`✅ Updated ${nullCount[0].count} rows with default account`);
      }

      // Make column NOT NULL
      console.log('   Making accountId required...');
      await prisma.$executeRaw`
        ALTER TABLE "SaleItem" 
        ALTER COLUMN "accountId" SET NOT NULL
      `;
      
      console.log('✅ accountId is now required');
    } else {
      // Step 2: Add column as nullable first
      console.log('📝 Step 1: Adding accountId column (nullable)...');
      await prisma.$executeRaw`
        ALTER TABLE "SaleItem" 
        ADD COLUMN "accountId" TEXT
      `;

      // Step 3: Get default income account
      console.log('📝 Step 2: Finding default income account...');
      const defaultAccount = await prisma.account.findFirst({
        where: {
          accountType: { in: ['Income', 'Revenue'] },
          isActive: true
        },
        orderBy: { accountCode: 'asc' }
      });

      if (!defaultAccount) {
        throw new Error('No active Income or Revenue account found. Please create one in Chart of Accounts first.');
      }

      console.log(`   Using default account: ${defaultAccount.accountCode} - ${defaultAccount.accountName}`);

      // Step 4: Set default value for existing rows
      console.log('📝 Step 3: Setting default account for existing rows...');
      const updateResult = await prisma.$executeRaw`
        UPDATE "SaleItem" 
        SET "accountId" = ${defaultAccount.id}
        WHERE "accountId" IS NULL
      `;
      console.log(`✅ Updated existing rows with default account`);

      // Step 5: Add foreign key constraint
      console.log('📝 Step 4: Adding foreign key constraint...');
      await prisma.$executeRaw`
        ALTER TABLE "SaleItem" 
        ADD CONSTRAINT "SaleItem_accountId_fkey" 
        FOREIGN KEY ("accountId") 
        REFERENCES "Account"("id")
      `;
      console.log('✅ Foreign key constraint added');

      // Step 6: Make column NOT NULL
      console.log('📝 Step 5: Making accountId required...');
      await prisma.$executeRaw`
        ALTER TABLE "SaleItem" 
        ALTER COLUMN "accountId" SET NOT NULL
      `;
      console.log('✅ accountId is now required');

      // Step 7: Create index
      console.log('📝 Step 6: Creating index on accountId...');
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "SaleItem_accountId_idx" 
        ON "SaleItem"("accountId")
      `;
      console.log('✅ Index created');
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart your application');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
