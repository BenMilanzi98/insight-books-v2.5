/**
 * Script to verify if accountId column exists in SaleItem table
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n🔍 Checking if accountId column exists in SaleItem table...\n');

    // Check if column exists using raw SQL
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'SaleItem' 
      AND column_name = 'accountId'
    `;

    if (result && result.length > 0) {
      console.log('✅ Column accountId EXISTS in SaleItem table');
      
      // Check for NULL values
      const nullCount = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM "SaleItem" 
        WHERE "accountId" IS NULL
      `;
      
      console.log(`   NULL values: ${nullCount[0].count}`);
      
      // Check if column is NOT NULL
      const columnInfo = await prisma.$queryRaw`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'SaleItem' 
        AND column_name = 'accountId'
      `;
      
      console.log(`   Is nullable: ${columnInfo[0].is_nullable}`);
      
      // Get sample accountId values
      const sample = await prisma.$queryRaw`
        SELECT "accountId", COUNT(*) as count
        FROM "SaleItem"
        GROUP BY "accountId"
        LIMIT 5
      `;
      
      console.log('\n   Sample accountId values:');
      sample.forEach(row => {
        console.log(`   - ${row.accountId}: ${row.count} items`);
      });
      
    } else {
      console.log('❌ Column accountId DOES NOT EXIST in SaleItem table');
      console.log('\n   Running migration now...');
      
      // Run the migration
      const fs = require('fs');
      const path = require('path');
      const sqlPath = path.join(__dirname, 'add-accountid-column.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      await prisma.$executeRawUnsafe(sql);
      
      console.log('✅ Migration completed!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
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

verify();
