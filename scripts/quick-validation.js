// scripts/quick-validation.js
/**
 * Quick validation script for expense categories feature
 * Checks database structure without detailed data validation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  console.log('\n==========================================');
  log('Expense Categories - Quick Validation', 'cyan');
  console.log('==========================================\n');

  try {
    // 1. Check database connection
    log('1. Checking database connection...', 'cyan');
    await prisma.$queryRaw`SELECT 1`;
    log('✓ Database connection OK', 'green');

    // 2. Check ExpenseCategory table
    console.log('\n2. Checking ExpenseCategory table...');
    try {
      const count = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "ExpenseCategory"
      `;
      const categoryCount = count[0]?.count || 0;
      log(`✓ ExpenseCategory table exists`, 'green');
      log(`  Found ${categoryCount} expense categories`, 'green');
    } catch (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        log('⚠ ExpenseCategory table does not exist (migration not applied?)', 'yellow');
      } else {
        throw error;
      }
    }

    // 3. Check Expense.categoryId column
    console.log('\n3. Checking Expense.categoryId column...');
    try {
      const withCat = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Expense" WHERE "categoryId" IS NOT NULL
      `;
      const withoutCat = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM "Expense" WHERE "categoryId" IS NULL
      `;
      log('✓ Expense.categoryId column exists', 'green');
      log(`  Expenses with categoryId: ${withCat[0]?.count || 0}`, 'green');
      log(`  Expenses without categoryId: ${withoutCat[0]?.count || 0} (backward compatible)`, 'green');
    } catch (error) {
      if (error.message.includes('column') || error.code === '42703') {
        log('⚠ Expense.categoryId column does not exist (migration not applied?)', 'yellow');
      } else {
        throw error;
      }
    }

    // 4. Check foreign key constraints
    console.log('\n4. Checking foreign key constraints...');
    try {
      const constraints = await prisma.$queryRaw`
        SELECT conname 
        FROM pg_constraint 
        WHERE conname IN (
          'Expense_categoryId_fkey',
          'ExpenseCategory_accountId_fkey',
          'ExpenseCategory_tenantId_fkey'
        )
      `;
      if (constraints.length > 0) {
        log(`✓ Found ${constraints.length} foreign key constraints`, 'green');
      } else {
        log('⚠ Some foreign key constraints may be missing', 'yellow');
      }
    } catch (error) {
      log('⚠ Could not check foreign key constraints', 'yellow');
    }

    // 5. Check account codes are in correct range
    console.log('\n5. Checking account code ranges...');
    try {
      const badCodes = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count 
        FROM "ExpenseCategory" 
        WHERE CAST("accountCode" AS INTEGER) NOT BETWEEN 5001 AND 5999
      `;
      const badCount = badCodes[0]?.count || 0;
      if (badCount === 0) {
        log('✓ All account codes are in range 5001-5999 (under 5000 - Expense)', 'green');
      } else {
        log(`⚠ ${badCount} account codes are outside range 5001-5999`, 'yellow');
      }
    } catch (error) {
      // Table might not exist yet
      log('⚠ Could not check account code ranges', 'yellow');
    }

    console.log('\n==========================================');
    log('Quick validation complete!', 'green');
    console.log('==========================================\n');
    console.log('For detailed validation, run:');
    console.log('  npm run validate:expense-categories');
    console.log('  npm run validate:data-integrity');

  } catch (error) {
    log(`\n✗ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
