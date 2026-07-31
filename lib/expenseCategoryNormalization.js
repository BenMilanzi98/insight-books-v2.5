// lib/expenseCategoryNormalization.js
/**
 * Expense Category Normalization Service
 * 
 * Silently normalizes expense categories to account codes in the backend
 * - Maps categories (including duplicates) to standard Chart of Accounts codes
 * - Keeps all existing categories visible to users
 * - Ensures historical transactions remain unchanged
 * - Uses account codes for reporting/grouping
 */

import prisma from './prisma.js';

/**
 * Standard expense category → canonical blueprint account codes only.
 * Never invent anti-blueprint codes (5001, 5018, 5501, …).
 */
const STANDARD_CATEGORY_MAPPINGS = {
  'office supplies': '5320',
  'office expenses': '5320',
  'stationery': '5320',
  'utilities': '5310',
  'electricity': '5311',
  'escom': '5311',
  'water': '5316',
  'water bill': '5316',
  'generator': '5317',
  'generator fuel': '5317',
  'diesel generator': '5317',
  'airtime': '5318',
  'business airtime': '5318',
  'mobile data': '5318',
  'internet': '5315',
  'telephone': '5315',
  'phone': '5315',
  'rent': '5300',
  'rental': '5300',
  'office rent': '5300',
  'insurance': '5370',
  'public liability': '5373',
  'goods in transit insurance': '5375',
  'professional fees': '5360',
  'legal fees': '5362',
  'accounting fees': '5361',
  'audit fees': '5361',
  'consulting': '5363',
  'consultancy': '5363',
  'company secretary': '5364',
  'secretarial fees': '5364',
  'bank charges': '5500',
  'bank fees': '5500',
  'service charges': '5500',
  'mobile money fees': '5505',
  'airtel money fees': '5505',
  'mpamba fees': '5505',
  'loan fees': '5515',
  'arrangement fees': '5515',
  'withholding tax': '5555',
  'wht expense': '5555',
  'travel': '5340',
  'transportation': '5340',
  'international travel': '5346',
  'fuel': '5341',
  'petrol': '5341',
  'gas': '5341',
  'vehicle maintenance': '5383',
  'car maintenance': '5383',
  'vehicle repairs': '5383',
  'parking': '5340',
  'tolls': '5340',
  'marketing': '5330',
  'advertising': '5330',
  'promotion': '5335',
  'promotions': '5335',
  'samples': '5335',
  'signage': '5334',
  'branding': '5334',
  'social media': '5331',
  'facebook ads': '5331',
  'google ads': '5331',
  salary: '5200',
  'salaries': '5200',
  'wages': '5200',
  'payroll': '5200',
  'directors fees': '5201',
  'directors remuneration': '5201',
  'leave pay': '5202',
  'ovetime allowance': '5205',
  'overtime allowance': '5205',
  'overtime': '5205',
  'software subscription': '5351',
  'software subscriptions': '5351',
  'software': '5351',
  'hosting': '5352',
  'it and hosting': '5350',
  'cursor': '5351',
  'software development': '5350',
  'system development': '5350',
  'development expense': '5350',
  'voice over': '5330',
  'studio voice over': '5330',
  'food allowance': '5600',
  'refreshment': '5600',
  'meals': '5600',
  'benefits': '5210',
  'training': '5610',
  'education': '5610',
  'courses': '5610',
  'workshops': '5610',
  'maintenance': '5380',
  'repairs': '5380',
  'equipment maintenance': '5382',
  'printing': '5321',
  'photocopying': '5321',
  'cleaning materials': '5322',
  'packaging': '5170',
  'customs': '5180',
  'clearing': '5180',
  'import duty': '5180',
  'warranty': '5670',
  'after sales': '5670',
  'safety': '5680',
  'board meeting': '5690',
  'miscellaneous': '5900',
  'misc': '5900',
  'other': '5900',
  'general expenses': '5900',
};

/**
 * Normalize category name for matching
 * - Converts to lowercase
 * - Trims whitespace
 * - Removes special characters (keeps alphanumeric and spaces)
 */
function normalizeCategoryName(categoryName) {
  if (!categoryName) return '';
  return categoryName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/** Normalized key for grouping free-text categories (read-only; matches mapping keys). */
export function normalizeCategoryNameForReporting(categoryName) {
  return normalizeCategoryName(categoryName);
}

/**
 * Map free-text category to standard mapping code without DB (for dashboards / reports).
 * Uses the same keys as STANDARD_CATEGORY_MAPPINGS.
 */
export function lookupStandardExpenseCodeFromCategorySync(categoryName) {
  const n = normalizeCategoryName(categoryName);
  if (!n) return null;
  return STANDARD_CATEGORY_MAPPINGS[n] ?? null;
}

/**
 * Find or create expense account for a category
 * Automatically maps categories to standard account codes
 */
export async function getOrCreateExpenseAccountForCategory(tenantId, categoryName) {
  if (!categoryName || !categoryName.trim()) {
    throw new Error('Category name is required');
  }

  const normalizedName = normalizeCategoryName(categoryName);
  
  // First, try to find existing account by category name (exact match)
  let account = await prisma.account.findFirst({
    where: {
      tenantId,
      accountType: 'Expense',
      accountName: { equals: categoryName, mode: 'insensitive' },
      isActive: true
    }
  });

  if (account) {
    return account;
  }

  // Try to find by normalized name
  if (normalizedName !== categoryName.toLowerCase()) {
    account = await prisma.account.findFirst({
      where: {
        tenantId,
        accountType: 'Expense',
        accountName: { equals: normalizedName, mode: 'insensitive' },
        isActive: true
      }
    });

    if (account) {
      return account;
    }
  }

  // Check standard mappings
  let accountCode = null;
  let standardAccountName = null;

  // Try exact match first
  if (STANDARD_CATEGORY_MAPPINGS[normalizedName]) {
    accountCode = STANDARD_CATEGORY_MAPPINGS[normalizedName];
    standardAccountName = getStandardAccountName(accountCode);
  } else {
    // Try partial match (contains)
    for (const [key, code] of Object.entries(STANDARD_CATEGORY_MAPPINGS)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        accountCode = code;
        standardAccountName = getStandardAccountName(code);
        break;
      }
    }
  }

  // If no standard mapping found, generate a new account code
  if (!accountCode) {
    accountCode = await generateNextExpenseAccountCode(tenantId);
    standardAccountName = categoryName; // Use original category name
  }

  // Check if account with this code already exists
  account = await prisma.account.findFirst({
    where: {
      tenantId,
      accountCode,
      accountType: 'Expense'
    }
  });

  if (account) {
    // Account exists with this code, use it
    // But update the name if it's different (for consistency)
    if (account.accountName.toLowerCase() !== standardAccountName.toLowerCase()) {
      // Check if we should update or create a new one
      // For now, we'll use the existing account to avoid duplicates
      return account;
    }
    return account;
  }

  // Parent: 5000 - Expense (so all categories accumulate under it)
  const parentExpense = await prisma.account.findFirst({
    where: {
      tenantId,
      isActive: true,
      OR: [{ accountCode: '5000' }, { code: '5000' }]
    },
    select: { id: true }
  });

  try {
    account = await prisma.account.create({
      data: {
        tenantId,
        accountCode,
        accountName: standardAccountName,
        accountType: 'Expense',
        normalBalance: 'Debit',
        description: `Expense account for ${categoryName}`,
        isActive: true,
        isSystem: false,
        ...(parentExpense?.id && { parentAccountId: parentExpense.id })
      }
    });

    return account;
  } catch (error) {
    // If account creation fails (e.g., duplicate code), try to find it
    if (error.code === 'P2002') {
      account = await prisma.account.findFirst({
        where: {
          tenantId,
          accountCode,
          accountType: 'Expense'
        }
      });
      
      if (account) {
        return account;
      }
    }
    throw error;
  }
}

/**
 * Get standard account name for a code
 */
function getStandardAccountName(accountCode) {
  const codeMappings = {
    '5001': 'Office Supplies',
    '5002': 'Utilities',
    '5003': 'Rent Expense',
    '5004': 'Insurance Expense',
    '5005': 'Professional Fees',
    '5006': 'Bank Charges',
    '5101': 'Travel & Transportation',
    '5102': 'Fuel Expense',
    '5103': 'Vehicle Maintenance',
    '5104': 'Parking & Tolls',
    '5200': 'Salaries & Wages',
    '5301': 'Salaries & Wages',
    '5300': 'Rent & Lease',
    '5330': 'Marketing & Advertising',
    '5360': 'Legal & Professional Fees',
    '5201': 'Legacy Salary Account',
    '5230': 'Legacy Salary Account',
    '5302': 'Employee Benefits',
    '5018': 'Overtime allowance',
    '5702': 'IT and Hosting',
    '5401': 'Training & Development',
    '5501': 'Maintenance & Repairs',
    '5901': 'Miscellaneous Expenses'
  };

  return codeMappings[accountCode] || `Expense Account ${accountCode}`;
}

/** @param {string} accountCode */
export function getStandardExpenseAccountName(accountCode) {
  return getStandardAccountName(accountCode);
}

/**
 * Generate next available expense account code (5001-5999 under 5000 - Expense)
 */
async function generateNextExpenseAccountCode(tenantId) {
  const existingAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      accountCode: { not: null }
    },
    select: { accountCode: true }
  });

  let existingCategories = [];
  try {
    existingCategories = await prisma.$queryRaw`
      SELECT "accountCode" FROM "ExpenseCategory" WHERE "tenantId" = ${tenantId}
    `;
  } catch (error) {
    if (error.code !== '42P01' && !error.message?.includes('does not exist')) {
      console.warn(`Warning checking ExpenseCategory: ${error.message}`);
    }
  }

  const usedSet = new Set(
    [
      ...existingAccounts.map(a => a.accountCode).filter(Boolean),
      ...existingCategories.map(c => c.accountCode).filter(Boolean)
    ].map(String)
  );

  // Sequential: first available code in 5001-5999
  for (let code = 5001; code <= 5999; code++) {
    const codeStr = String(code);
    if (!usedSet.has(codeStr)) return codeStr;
  }

  throw new Error('Expense account code range (5001-5999) is exhausted');
}

/**
 * Normalize all existing expenses to use account codes
 * This is a one-time migration function
 */
export async function normalizeExistingExpenses(tenantId) {
  console.log(`Starting expense category normalization for tenant: ${tenantId}`);

  // Get all expenses and filter to those without expenseAccountId
  // Handle cases where expenseAccountId might be null in DB but schema expects non-null
  let allExpenses = [];
  try {
    allExpenses = await prisma.expense.findMany({
      where: {
        tenantId,
        isDeleted: false
      },
      select: {
        id: true,
        category: true,
        expenseAccountId: true
      }
    });
  } catch (error) {
    // If there's a type mismatch (null values in DB), use raw query
    if (error.code === 'P2032' || (error.message && error.message.includes('null'))) {
      const rawExpenses = await prisma.$queryRaw`
        SELECT id, category, "expenseAccountId"
        FROM "Expense"
        WHERE "tenantId" = ${tenantId}
          AND "isDeleted" = false
          AND ("expenseAccountId" IS NULL OR "expenseAccountId" = '')
      `;
      allExpenses = rawExpenses.map(exp => ({
        id: exp.id,
        category: exp.category,
        expenseAccountId: exp.expenseAccountId || null
      }));
    } else {
      throw error;
    }
  }
  
  // Filter to only those without expenseAccountId and with a category
  const expenses = allExpenses.filter(exp => 
    (!exp.expenseAccountId || exp.expenseAccountId === '') && 
    exp.category && 
    exp.category.trim() !== ''
  );

  console.log(`Found ${expenses.length} expenses to normalize`);

  let normalized = 0;
  let errors = 0;

  for (const expense of expenses) {
    try {
      if (!expense.category) {
        continue; // Skip expenses without category
      }

      // Get or create account for this category
      const account = await getOrCreateExpenseAccountForCategory(
        tenantId,
        expense.category
      );

      // Update expense with account ID
      await prisma.expense.update({
        where: { id: expense.id },
        data: { expenseAccountId: account.id }
      });

      normalized++;
    } catch (error) {
      console.error(`Error normalizing expense ${expense.id}:`, error);
      errors++;
    }
  }

  console.log(`Normalization complete: ${normalized} normalized, ${errors} errors`);

  return {
    total: expenses.length,
    normalized,
    errors
  };
}

/**
 * Get account code for a category (for reporting/grouping)
 * Returns the account code that should be used for grouping this category
 */
export async function getAccountCodeForCategory(tenantId, categoryName) {
  if (!categoryName) return null;

  try {
    const account = await getOrCreateExpenseAccountForCategory(tenantId, categoryName);
    return account.accountCode;
  } catch (error) {
    console.error(`Error getting account code for category ${categoryName}:`, error);
    return null;
  }
}

/**
 * Get all unique categories with their account codes
 * Used for reporting/grouping
 */
export async function getCategoryAccountCodeMap(tenantId) {
  // Get all unique categories from expenses
  const categories = await prisma.expense.findMany({
    where: {
      tenantId,
      isDeleted: false,
      category: { not: null }
    },
    select: {
      category: true,
      expenseAccountId: true
    },
    distinct: ['category']
  });

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
      const account = await getOrCreateExpenseAccountForCategory(
        tenantId,
        expense.category
      );
      accountCode = account.accountCode;
    }

    categoryMap[expense.category] = accountCode;
  }

  return categoryMap;
}
