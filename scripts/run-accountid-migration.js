/**
 * Migration script to add accountId to SaleItem and other tables
 * Uses Prisma to execute SQL, so it can access the database connection
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('\n🔄 Starting migration: Add accountId columns...\n');

    // Read the SQL script
    const sqlPath = path.join(__dirname, 'add-accountid-column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL script
    console.log('📝 Executing SQL migration...');
    await prisma.$executeRawUnsafe(sql);

    console.log('\n✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Restart your Next.js server');
    console.log('2. Test creating a sale in POS');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.message.includes('No active Income or Revenue account found')) {
      console.error('\n⚠️  Please ensure you have an active Income or Revenue account in Chart of Accounts.');
      console.error('   Go to /chart-of-accounts and create/activate a Revenue account (e.g., code 4000).');
    } else if (error.message.includes('already exists')) {
      console.log('\n✅ Column already exists - migration may have already been run.');
    } else {
      console.error('\nError details:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      });
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
