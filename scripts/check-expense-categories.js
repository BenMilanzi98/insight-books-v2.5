/**
 * Run the same logic as GET /api/categories?type=expense and print the result.
 * Usage: node scripts/check-expense-categories.js [tenantId]
 * If no tenantId, uses the first tenant in the DB.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {

  const tenantId = process.argv[2] || (await prisma.tenant.findFirst({ select: { id: true } }))?.id;
  if (!tenantId) {
    console.error('No tenant found. Pass tenantId: node scripts/check-expense-categories.js <tenantId>');
    process.exit(1);
  }
  console.log('Using tenantId:', tenantId);

  const categoriesById = new Map();
  const toEntry = (id, code, name, account, description, fromExpenseCategory = false) => {
    const entry = {
      id,
      code: code || '',
      name: name || 'Unnamed',
      accountId: id,
      account: account ?? null,
      description: description ?? null
    };
    if (fromExpenseCategory) entry._fromExpenseCategory = true;
    return entry;
  };

  const normalizeName = (s) => {
    let n = (s || '')
      .replace(/^\d+\s*-\s*/, '')
      .replace(/\s*&\s*/g, ' and ')
      .trim()
      .toLowerCase()
      .replace(/\s+expense(s)?\s*$/i, '')
      .replace(/\s+/g, ' ');
    return n.trim() || (s || '').toLowerCase();
  };

  try {
    const expenseCategories = await prisma.expenseCategory.findMany({
      where: { tenantId },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            isActive: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    expenseCategories.forEach(cat => {
      const id = cat.accountId;
      if (categoriesById.has(id)) return;
      categoriesById.set(id, toEntry(id, cat.accountCode, cat.name, cat.account, cat.description, true));
    });
  } catch (e) {
    console.warn('ExpenseCategory:', e?.message);
  }

  const accountSelect = {
    id: true,
    accountCode: true,
    accountName: true,
    name: true,
    accountType: true,
    accountSubtype: true,
    isActive: true
  };
  const baseWhere = { tenantId, isActive: true };
  let byTypeAccounts = [];
  let byCodeAccounts = [];
  try {
    [byTypeAccounts, byCodeAccounts] = await Promise.all([
      prisma.account.findMany({
        where: {
          ...baseWhere,
          OR: [
            { accountType: { equals: 'Expense', mode: 'insensitive' } },
            { type: { equals: 'Expense', mode: 'insensitive' } },
            { accountSubtype: { equals: 'Cost of Sales', mode: 'insensitive' } },
            { accountSubtype: { equals: 'Operating Expense', mode: 'insensitive' } },
            { accountSubtype: { equals: 'Other Expense', mode: 'insensitive' } }
          ]
        },
        select: accountSelect,
        orderBy: { accountName: 'asc' }
      }),
      prisma.account.findMany({
        where: {
          ...baseWhere,
          OR: [
            { accountCode: { gte: '5000', lte: '5999' } },
            { code: { gte: '5000', lte: '5999' } }
          ]
        },
        select: accountSelect,
        orderBy: { accountName: 'asc' }
      })
    ]);
  } catch (e) {
    console.warn('Account queries:', e?.message);
  }

  const accountsById = new Map();
  [...byTypeAccounts, ...byCodeAccounts].forEach(acc => accountsById.set(acc.id, acc));

  accountsById.forEach((acc, id) => {
    if (categoriesById.has(id)) return;
    const label = acc.accountName || acc.name || acc.accountCode || 'Unnamed';
    categoriesById.set(id, toEntry(id, acc.accountCode || acc.code, label, acc, null, false));
  });

  let list = Array.from(categoriesById.values());
  const byNormalizedName = new Map();
  list
    .sort((a, b) => {
      const aNorm = normalizeName(a.name);
      const bNorm = normalizeName(b.name);
      if (aNorm !== bNorm) return aNorm.localeCompare(bNorm);
      if (a._fromExpenseCategory !== b._fromExpenseCategory) return a._fromExpenseCategory ? -1 : 1;
      return (a.code || '').localeCompare(b.code || '');
    })
    .forEach((cat) => {
      const key = normalizeName(cat.name);
      if (byNormalizedName.has(key)) return;
      byNormalizedName.set(key, cat);
    });

  const cleanDisplayName = (name) => {
    if (!name || typeof name !== 'string') return name || 'Unnamed';
    const withoutCode = name.replace(/^\d+\s*-\s*/, '').trim();
    return withoutCode || name;
  };
  const categories = Array.from(byNormalizedName.values()).map(({ _fromExpenseCategory, ...cat }) => ({
    ...cat,
    name: cleanDisplayName(cat.name),
  }));
  categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Summary
  const nameCounts = {};
  categories.forEach(c => {
    const n = (c.name || '').trim().toLowerCase();
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  const duplicates = Object.entries(nameCounts).filter(([, count]) => count > 1);

  console.log('\n--- Counts ---');
  console.log('categoriesById (before name dedupe):', list.length);
  console.log('categories (after name dedupe):', categories.length);
  if (duplicates.length) {
    console.log('Duplicate display names:', duplicates);
  } else {
    console.log('No duplicate display names.');
  }

  console.log('\n--- Categories returned by API (id, code, name) ---');
  categories.forEach((c, i) => {
    console.log(`${i + 1}. id=${c.id} code=${c.code} name=${JSON.stringify(c.name)}`);
  });

  console.log('\n--- JSON (categories only) ---');
  console.log(JSON.stringify({ categories, type: 'expense' }, null, 2));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
