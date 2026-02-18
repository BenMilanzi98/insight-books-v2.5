// scripts/normalize-expense-categories.js
/**
 * Migration script to normalize existing expense categories to account codes
 * 
 * This script:
 * - Maps all existing expense categories to standard Chart of Accounts codes
 * - Ensures duplicate categories map to the same account code
 * - Keeps all existing categories visible to users
 * - Does not modify historical transactions (only adds expenseAccountId)
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Dynamic import for ES module
let normalizationService;
async function getNormalizationService() {
  if (!normalizationService) {
    try {
      const modulePath = require('path').join(__dirname, '../lib/expenseCategoryNormalization.js');
      normalizationService = await import(modulePath);
    } catch (error) {
      console.error('Error importing normalization service:', error);
      throw error;
    }
  }
  return normalizationService;
}

async function main() {
  console.log('\n==========================================');
  console.log('Expense Category Normalization Script');
  console.log('==========================================\n');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true
      }
    });

    console.log(`Found ${tenants.length} tenant(s) to process\n`);

    for (const tenant of tenants) {
      console.log(`\nProcessing tenant: ${tenant.name} (${tenant.id})`);
      console.log('------------------------------------------');

      try {
        // Get normalization service
        const normService = await getNormalizationService();
        
        // Normalize expenses for this tenant
        const result = await normService.normalizeExistingExpenses(tenant.id);

        console.log(`✓ Normalized ${result.normalized} expenses`);
        if (result.errors > 0) {
          console.log(`⚠ ${result.errors} errors encountered`);
        }

        // Show category mapping summary
        const categoryMap = await getCategoryAccountCodeMap(tenant.id, normService);
        const uniqueCategories = Object.keys(categoryMap).length;
        const uniqueAccountCodes = new Set(Object.values(categoryMap)).size;

        console.log(`\nCategory Mapping Summary:`);
        console.log(`  - Unique categories: ${uniqueCategories}`);
        console.log(`  - Unique account codes: ${uniqueAccountCodes}`);
        console.log(`  - Consolidation ratio: ${(uniqueCategories / uniqueAccountCodes).toFixed(2)}:1`);

        // Show top 10 category mappings
        const categoryEntries = Object.entries(categoryMap)
          .sort((a, b) => {
            // Count expenses per category
            return 0; // Simple sort for now
          })
          .slice(0, 10);

        if (categoryEntries.length > 0) {
          console.log(`\nSample Category Mappings (top 10):`);
          categoryEntries.forEach(([category, code]) => {
            console.log(`  "${category}" → Account Code ${code}`);
          });
        }

      } catch (error) {
        console.error(`✗ Error processing tenant ${tenant.name}:`, error.message);
        console.error(error);
      }
    }

    console.log('\n==========================================');
    console.log('Normalization Complete!');
    console.log('==========================================\n');

  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    throw error;
  }
}

async function getCategoryAccountCodeMap(tenantId, normService) {
  // Get all expenses with categories
  const allExpenses = await prisma.expense.findMany({
    where: {
      tenantId,
      isDeleted: false
    },
    select: {
      category: true,
      expenseAccountId: true
    }
  });
  
  // Get unique categories (filter out null/empty categories)
  const uniqueCategories = new Map();
  allExpenses.forEach(expense => {
    if (expense.category && !uniqueCategories.has(expense.category)) {
      uniqueCategories.set(expense.category, expense.expenseAccountId);
    }
  });
  
  const categories = Array.from(uniqueCategories.entries()).map(([category, expenseAccountId]) => ({
    category,
    expenseAccountId
  }));

  const categoryMap = {};

  for (const expense of categories) {
    if (!expense.category) continue;

    let accountCode = null;
    
    if (expense.expenseAccountId) {
      const account = await prisma.account.findUnique({
        where: { id: expense.expenseAccountId },
        select: { accountCode: true }
      });
      accountCode = account?.accountCode || null;
    }

    // If no account code yet, get/create one
    if (!accountCode) {
      const account = await normService.getOrCreateExpenseAccountForCategory(
        tenantId,
        expense.category
      );
      accountCode = account.accountCode;
    }

    categoryMap[expense.category] = accountCode;
  }

  return categoryMap;
}

main()
  .catch((e) => {
    console.error('\n✗ Fatal error:', e.message);
    if (e.stack) {
      console.error('\nStack trace:');
      console.error(e.stack);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
