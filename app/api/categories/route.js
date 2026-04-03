import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { ensureExpenseAccountsForTenant, EXPENSE_ACCOUNTS_TEMPLATE } from '@/lib/expenseCategoriesTemplate';

/** Product/stock categories (InventoryCategory model). API accepts `stock` or `inventory`; DB unchanged. */
function isProductCategoryType(type) {
  return type === 'inventory' || type === 'stock';
}

// GET - Fetch categories for a tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'expense', 'inventory', or 'stock'

    let categories = [];

    if (isProductCategoryType(type)) {
      // For inventory categories, we'll use the InventoryCategory model
      const inventoryCategories = await prisma.inventoryCategory.findMany({
        where: {
          tenantId: user.tenantId
        },
        select: {
          id: true,
          name: true,
          description: true,
          color: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      categories = inventoryCategories.map(cat => cat.name);
    } else {
      // Expense categories: only for the current tenant; one entry per logical name (dedupe by normalized name)
      if (!user.tenantId) {
        return NextResponse.json({ categories: [], type: 'expense' });
      }
      const tenantId = user.tenantId;

      const categoriesById = new Map();
      const toEntry = (accountId, code, name, account, description, fromExpenseCategory = false, expCatId = null) => {
        const entry = {
          id: expCatId || accountId,
          code: code || '',
          name: name || 'Unnamed',
          accountId,
          expenseCategoryId: expCatId || null,
          account: account ?? null,
          description: description ?? null
        };
        if (fromExpenseCategory) entry._fromExpenseCategory = true;
        return entry;
      };

      // Normalize name for deduplication so "Bank Charges", "5190 - Bank Charges", "Marketing & Advertising Expense" collapse to one
      const normalizeName = (s) => {
        let n = (s || '')
          .replace(/^\d+\s*-\s*/, '')  // strip leading "CODE - "
          .replace(/\s*&\s*/g, ' and ') // "Marketing & Advertising" -> "Marketing and Advertising"
          .trim()
          .toLowerCase()
          .replace(/\s+expense(s)?\s*$/i, '')  // strip trailing " expense" or " expenses"
          .replace(/\s+/g, ' ');               // collapse multiple spaces
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
          const accountId = cat.accountId;
          if (categoriesById.has(accountId)) return;
          categoriesById.set(accountId, toEntry(accountId, cat.accountCode, cat.name, cat.account, cat.description, true, cat.id));
        });
      } catch (expenseCatErr) {
        console.warn('Categories API: expense categories unavailable:', expenseCatErr?.message || expenseCatErr);
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
      try {
        let byTypeAccounts = [];
        let byCodeAccounts = [];
        const runQueries = async () => {
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
        };
        await runQueries();
        const accountsById = new Map();
        [...byTypeAccounts, ...byCodeAccounts].forEach(acc => accountsById.set(acc.id, acc));
        const templateCodes = EXPENSE_ACCOUNTS_TEMPLATE.map((t) => t.code);
        const existingTemplateCount = await prisma.account.count({
          where: { tenantId, accountCode: { in: templateCodes } }
        });
        if (existingTemplateCount < EXPENSE_ACCOUNTS_TEMPLATE.length) {
          try {
            await ensureExpenseAccountsForTenant(tenantId, prisma);
            await runQueries();
            accountsById.clear();
            [...byTypeAccounts, ...byCodeAccounts].forEach(acc => accountsById.set(acc.id, acc));
          } catch (ensureErr) {
            console.warn('Categories API: could not ensure expense accounts:', ensureErr?.message || ensureErr);
          }
        }
        accountsById.forEach((acc, id) => {
          if (categoriesById.has(id)) return;
          const label = acc.accountName || acc.name || acc.accountCode || 'Unnamed';
          categoriesById.set(id, toEntry(id, acc.accountCode || acc.code, label, acc, null, false));
        });
      } catch (accountErr) {
        console.warn('Categories API: expense accounts unavailable:', accountErr?.message || accountErr);
      }

      // Auto-create ExpenseCategory records for Account-only entries so dropdowns always have valid IDs
      const accountOnlyEntries = Array.from(categoriesById.values()).filter(e => !e.expenseCategoryId);
      if (accountOnlyEntries.length > 0) {
        for (const entry of accountOnlyEntries) {
          try {
            let ec = await prisma.expenseCategory.findFirst({
              where: { accountId: entry.accountId, tenantId }
            });
            if (!ec) {
              ec = await prisma.expenseCategory.create({
                data: {
                  name: entry.name || 'Unnamed',
                  accountId: entry.accountId,
                  accountCode: entry.code || '',
                  tenantId,
                }
              });
            }
            entry.id = ec.id;
            entry.expenseCategoryId = ec.id;
            entry._fromExpenseCategory = true;
          } catch (autoCreateErr) {
            // Non-fatal: keep the Account ID; backend will handle lookup
          }
        }
      }

      let list = Array.from(categoriesById.values());
      // Deduplicate by normalized name: keep one per logical name (prefer ExpenseCategory entry, else smallest code)
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

      // Merge similar categories: when one name is a clear variant of another (e.g. "tax" vs "tax expense", "marketing" vs "marketing and advertising"), keep the more specific (longer) one. Avoid merging generic "expense" into everything.
      const keys = [...byNormalizedName.keys()];
      const isVariantOf = (shortKey, longKey) => {
        if (longKey.length <= shortKey.length || !longKey.includes(shortKey)) return false;
        // Long is "short + expense(s)" or "short + something" (word boundary)
        if (longKey === shortKey + ' expense' || longKey === shortKey + ' expenses') return true;
        if (longKey.startsWith(shortKey + ' ')) return true;
        if (longKey.endsWith(' ' + shortKey)) return true;
        return false;
      };
      const getCanonicalKey = (key) => {
        let best = key;
        for (const other of keys) {
          if (other.length <= best.length) continue;
          if (isVariantOf(key, other)) best = other; // key is short form of other
        }
        return best;
      };
      const merged = new Map();
      for (const [key, cat] of byNormalizedName) {
        const canon = getCanonicalKey(key);
        const existing = merged.get(canon);
        if (!existing) {
          merged.set(canon, cat);
          continue;
        }
        const existingNorm = normalizeName(existing.name);
        if (cat._fromExpenseCategory && !existing._fromExpenseCategory) merged.set(canon, cat);
        else if (!cat._fromExpenseCategory && existing._fromExpenseCategory) { /* keep existing */ }
        else if (key.length > existingNorm.length) merged.set(canon, cat);
        else if (key.length === existingNorm.length && (cat.code || '').localeCompare(existing.code || '') < 0) merged.set(canon, cat);
      }

      // Prefer display name without "CODE - " prefix so dropdown shows "Bank Charges" not "5190 - Bank Charges"
      const cleanDisplayName = (name) => {
        if (!name || typeof name !== 'string') return name || 'Unnamed';
        const withoutCode = name.replace(/^\d+\s*-\s*/, '').trim();
        return withoutCode || name;
      };
      categories = Array.from(merged.values()).map(({ _fromExpenseCategory, ...cat }) => ({
        ...cat,
        name: cleanDisplayName(cat.name),
        expenseCategoryId: cat.expenseCategoryId || null,
      }));
      categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return NextResponse.json({
      categories,
      type
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST - Create a new category
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, type, description, color } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    let category;

    if (isProductCategoryType(type)) {
      // Create inventory category
      category = await prisma.inventoryCategory.create({
        data: {
          name: name.trim(),
          description: description || null,
          color: color || '#4f46e5',
          tenantId: user.tenantId
        }
      });
    } else if (type === 'expense') {
      // Redirect to expense categories endpoint
      return NextResponse.json(
        { error: 'Please use /api/expense-categories to create expense categories' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid category type. Use "stock", "inventory", or "expense"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
} 