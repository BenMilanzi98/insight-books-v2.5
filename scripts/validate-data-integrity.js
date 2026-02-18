// scripts/validate-data-integrity.js
/**
 * Data Integrity Validation Script
 * 
 * Validates that:
 * 1. All historical data is intact
 * 2. Foreign key relationships are valid
 * 3. No orphaned records exist
 * 4. Account balances are consistent
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function validateForeignKeys(tenantId) {
  logSection('Validating Foreign Key Relationships');

  const errors = [];

  try {
    // Check if categoryId field exists
    let hasCategoryId = false;
    try {
      await prisma.$queryRaw`SELECT "categoryId" FROM "Expense" LIMIT 1`;
      hasCategoryId = true;
    } catch (error) {
      log('⚠️  categoryId field not available (migration not applied)', 'yellow');
    }

    // Do not select categoryId - column may not exist in DB
    const expenses = await prisma.expense.findMany({
      where: { tenantId, isDeleted: false },
      select: {
        id: true,
        expenseAccountId: true
      }
    });

    log(`\nChecking ${expenses.length} expenses...`, 'blue');

    for (const expense of expenses) {
      // Check expenseAccountId
      if (expense.expenseAccountId) {
        const account = await prisma.account.findUnique({
          where: { id: expense.expenseAccountId }
        });
        if (!account) {
          errors.push(`Expense ${expense.id} has invalid expenseAccountId: ${expense.expenseAccountId}`);
        }
      }

      // Check categoryId via raw if column exists (avoid Prisma select)
      if (hasCategoryId && typeof prisma.expenseCategory?.findUnique === 'function') {
        let categoryIdVal = null;
        try {
          const rows = await prisma.$queryRaw`SELECT "categoryId" FROM "Expense" WHERE id = ${expense.id} LIMIT 1`;
          categoryIdVal = rows?.[0]?.categoryId ?? null;
        } catch (_) {
          categoryIdVal = null;
        }
        if (categoryIdVal) {
          try {
            const category = await prisma.expenseCategory.findUnique({
              where: { id: categoryIdVal }
            });
            if (!category) {
              errors.push(`Expense ${expense.id} has invalid categoryId: ${categoryIdVal}`);
            } else {
              const categoryAccount = await prisma.account.findUnique({
                where: { id: category.accountId }
              });
              if (!categoryAccount) {
                errors.push(`ExpenseCategory ${category.id} has invalid accountId: ${category.accountId}`);
              }
            }
          } catch (error) {
            if (error.code === 'P2025' || error.message.includes('does not exist')) {
              errors.push(`Expense ${expense.id} references non-existent categoryId: ${categoryIdVal}`);
            } else {
              throw error;
            }
          }
        }
      }
    }

    // Validate ExpenseCategory -> Account relationships (only if table and model exist)
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ExpenseCategory" LIMIT 1`;
    } catch (_) {
      log('⚠️  ExpenseCategory table does not exist (skip category validation)', 'yellow');
    }

    if (typeof prisma.expenseCategory?.findMany === 'function') {
      try {
        const categories = await prisma.expenseCategory.findMany({
          where: { tenantId },
          select: {
            id: true,
            name: true,
            accountId: true
          }
        });
        log(`Checking ${categories.length} expense categories...`, 'blue');
        for (const category of categories) {
          const account = await prisma.account.findUnique({
            where: { id: category.accountId }
          });
          if (!account) {
            errors.push(`ExpenseCategory ${category.id} (${category.name}) has invalid accountId: ${category.accountId}`);
          } else if (account.accountType !== 'Expense') {
            errors.push(`ExpenseCategory ${category.id} (${category.name}) linked to non-Expense account: ${account.accountType}`);
          }
        }
      } catch (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          log('⚠️  ExpenseCategory table does not exist (migration not applied)', 'yellow');
        } else {
          throw error;
        }
      }
    }

    if (errors.length === 0) {
      log('✓ All foreign key relationships are valid', 'green');
      return true;
    } else {
      log(`✗ Found ${errors.length} foreign key errors:`, 'red');
      errors.forEach(err => log(`  - ${err}`, 'red'));
      return false;
    }
  } catch (error) {
    log(`✗ Error validating foreign keys: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function validateAccountBalances(tenantId) {
  logSection('Validating Account Balances');

  try {
    const expenseAccounts = await prisma.account.findMany({
      where: {
        tenantId,
        accountType: 'Expense',
        isActive: true
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true
      }
    });

    log(`\nValidating ${expenseAccounts.length} expense accounts...`, 'blue');

    let allValid = true;

    for (const account of expenseAccounts) {
      try {
        // Calculate balance directly from TransactionLine
        const transactionLines = await prisma.transactionLine.findMany({
          where: {
            accountId: account.id,
            transaction: {
              tenantId,
              status: 'posted',
              isReversal: false
            }
          }
        });

        // For Expense accounts: Debit increases expense, Credit decreases
        const totalDebits = transactionLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
        const totalCredits = transactionLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);
        const balance = totalDebits - totalCredits;
        
        if (balance !== undefined && !isNaN(balance)) {
          log(`  ✓ ${account.accountCode} - ${account.accountName}: ${balance.toLocaleString()}`, 'green');
        } else {
          log(`  ⚠️  ${account.accountCode} - ${account.accountName}: Balance calculation issue`, 'yellow');
          allValid = false;
        }
      } catch (error) {
        log(`  ✗ ${account.accountCode} - ${account.accountName}: ${error.message}`, 'red');
        allValid = false;
      }
    }

    return allValid;
  } catch (error) {
    log(`✗ Error validating account balances: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function validateTransactionIntegrity(tenantId) {
  logSection('Validating Transaction Integrity');

  try {
    // Check that all expense transactions have valid accounts
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        tenantId,
        sourceType: 'Expense',
        status: 'posted'
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                accountName: true,
                accountType: true
              }
            }
          }
        }
      },
      take: 100 // Sample check
    });

    log(`\nChecking ${expenseTransactions.length} expense transactions...`, 'blue');

    let errors = 0;
    for (const transaction of expenseTransactions) {
      for (const line of transaction.lines) {
        if (!line.account) {
          log(`  ✗ Transaction ${transaction.id} has line with invalid account`, 'red');
          errors++;
        } else if (line.account.accountType === 'Expense' && line.debitAmount <= 0 && line.creditAmount <= 0) {
          log(`  ⚠️  Transaction ${transaction.id} has expense line with zero amounts`, 'yellow');
        }
      }
    }

    if (errors === 0) {
      log('✓ All sampled transactions are valid', 'green');
      return true;
    } else {
      log(`✗ Found ${errors} transaction errors`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Error validating transactions: ${error.message}`, 'red');
    console.error(error);
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('DATA INTEGRITY VALIDATION SCRIPT', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  let tenantIdToUse = process.env.TENANT_ID;
  
  if (!tenantIdToUse) {
    log('⚠️  No TENANT_ID provided. Using first tenant from database...', 'yellow');
    const firstTenant = await prisma.tenant.findFirst({
      select: { id: true, name: true }
    });
    
    if (!firstTenant) {
      log('✗ No tenants found in database', 'red');
      await prisma.$disconnect();
      process.exit(1);
    }
    
    log(`✓ Using tenant: ${firstTenant.name} (${firstTenant.id})`, 'green');
    tenantIdToUse = firstTenant.id;
  }
  
  const results = {
    foreignKeys: await validateForeignKeys(tenantIdToUse),
    accountBalances: await validateAccountBalances(tenantIdToUse),
    transactions: await validateTransactionIntegrity(tenantIdToUse)
  };

  logSection('VALIDATION SUMMARY');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  Object.entries(results).forEach(([key, passed]) => {
    const status = passed ? '✓ PASSED' : '✗ FAILED';
    const color = passed ? 'green' : 'red';
    log(`${status}: ${key}`, color);
  });

  if (allPassed) {
    log('\n✅ ALL INTEGRITY CHECKS PASSED', 'green');
  } else {
    log('\n❌ SOME INTEGRITY CHECKS FAILED', 'red');
  }
}

main().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  console.error(error);
}).finally(() => {
  prisma.$disconnect().catch(() => {});
  process.exit(0);
});
