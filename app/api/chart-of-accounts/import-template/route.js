// app/api/chart-of-accounts/import-template/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { EXPENSE_ACCOUNTS_TEMPLATE } from '@/lib/expenseCategoriesTemplate';

const isFinanceAdmin = (user) => {
  const roleName = user?.role?.name?.toLowerCase() || '';
  return roleName.includes('finance') || roleName.includes('admin') || roleName === 'master_admin';
};

// Standard Chart of Accounts Template (non-expense; expense accounts from lib/expenseCategoriesTemplate.js)
const STANDARD_COA_TEMPLATE = [
  // ASSETS
  { code: '1000', name: 'CURRENT ASSETS', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: null },
  { code: '1010', name: 'Cash on Hand', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1000' },
  { code: '1020', name: 'Cash in Bank', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1000' },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1000' },
  { code: '1110', name: 'Allowance for Doubtful Debts', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Credit', parentCode: '1000' },
  { code: '1200', name: 'Inventory', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1000' },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1000' },
  { code: '1310', name: 'Prepaid Rent', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1300' },
  { code: '1320', name: 'Prepaid Insurance', type: 'Asset', subtype: 'Current Asset', normalBalance: 'Debit', parentCode: '1300' },

  { code: '1500', name: 'NON-CURRENT ASSETS', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: null },
  { code: '1510', name: 'Land', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1520', name: 'Buildings', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1521', name: 'Accumulated Depreciation - Buildings', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Credit', parentCode: '1500' },
  { code: '1530', name: 'Equipment', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1531', name: 'Accumulated Depreciation - Equipment', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Credit', parentCode: '1500' },
  { code: '1540', name: 'Furniture & Fixtures', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1541', name: 'Accumulated Depreciation - Furniture', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Credit', parentCode: '1500' },
  { code: '1550', name: 'Vehicles', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1551', name: 'Accumulated Depreciation - Vehicles', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Credit', parentCode: '1500' },
  { code: '1560', name: 'Computer Equipment', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Debit', parentCode: '1500' },
  { code: '1561', name: 'Accumulated Depreciation - Computer Equipment', type: 'Asset', subtype: 'Non-Current Asset', normalBalance: 'Credit', parentCode: '1500' },

  // LIABILITIES
  { code: '2000', name: 'CURRENT LIABILITIES', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: null },
  { code: '2010', name: 'Accounts Payable', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2020', name: 'Accrued Expenses', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2030', name: 'Salaries Payable', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2040', name: 'Tax Payable', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2041', name: 'Tax Inflow (Collected)', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2045', name: 'Tax Outflow (Paid)', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2050', name: 'Short-term Loans', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },
  { code: '2060', name: 'Unearned Revenue', type: 'Liability', subtype: 'Current Liability', normalBalance: 'Credit', parentCode: '2000' },

  { code: '2500', name: 'NON-CURRENT LIABILITIES', type: 'Liability', subtype: 'Non-Current Liability', normalBalance: 'Credit', parentCode: null },
  { code: '2510', name: 'Long-term Loans', type: 'Liability', subtype: 'Non-Current Liability', normalBalance: 'Credit', parentCode: '2500' },
  { code: '2520', name: 'Mortgage Payable', type: 'Liability', subtype: 'Non-Current Liability', normalBalance: 'Credit', parentCode: '2500' },
  { code: '2530', name: 'Bonds Payable', type: 'Liability', subtype: 'Non-Current Liability', normalBalance: 'Credit', parentCode: '2500' },

  // EQUITY
  { code: '3000', name: "OWNER'S EQUITY", type: 'Equity', subtype: null, normalBalance: 'Credit', parentCode: null },
  { code: '3010', name: "Owner's Capital / Share Capital", type: 'Equity', subtype: null, normalBalance: 'Credit', parentCode: '3000' },
  { code: '3020', name: 'Retained Earnings', type: 'Equity', subtype: null, normalBalance: 'Credit', parentCode: '3000' },
  { code: '3030', name: 'Current Year Earnings', type: 'Equity', subtype: null, normalBalance: 'Credit', parentCode: '3000' },
  { code: '3040', name: 'Drawings / Dividends', type: 'Equity', subtype: null, normalBalance: 'Debit', parentCode: '3000' },

  // INCOME
  { code: '4000', name: 'OPERATING INCOME', type: 'Income', subtype: 'Operating Income', normalBalance: 'Credit', parentCode: null },
  { code: '4010', name: 'Sales Revenue', type: 'Income', subtype: 'Operating Income', normalBalance: 'Credit', parentCode: '4000' },
  { code: '4020', name: 'Service Revenue', type: 'Income', subtype: 'Operating Income', normalBalance: 'Credit', parentCode: '4000' },
  { code: '4030', name: 'Consulting Revenue', type: 'Income', subtype: 'Operating Income', normalBalance: 'Credit', parentCode: '4000' },

  { code: '4500', name: 'OTHER INCOME', type: 'Income', subtype: 'Other Income', normalBalance: 'Credit', parentCode: null },
  { code: '4510', name: 'Interest Income', type: 'Income', subtype: 'Other Income', normalBalance: 'Credit', parentCode: '4500' },
  { code: '4520', name: 'Gain on Sale of Assets', type: 'Income', subtype: 'Other Income', normalBalance: 'Credit', parentCode: '4500' },
  { code: '4530', name: 'Miscellaneous Income', type: 'Income', subtype: 'Other Income', normalBalance: 'Credit', parentCode: '4500' },

  // EXPENSE (5000–5999) — single source of truth from lib/expenseCategoriesTemplate.js
  ...EXPENSE_ACCOUNTS_TEMPLATE
];

// POST - Import standard COA template
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    if (!isFinanceAdmin(user)) {
      return NextResponse.json(
        { error: 'Access denied. Finance or Admin role required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { overwriteExisting = false } = body;

    // Check if accounts already exist
    const existingAccounts = await prisma.account.findMany({
      where: { tenantId: user.tenantId },
      select: { accountCode: true }
    });

    if (existingAccounts.length > 0 && !overwriteExisting) {
      return NextResponse.json(
        { error: 'Accounts already exist. Set overwriteExisting to true to replace them.' },
        { status: 400 }
      );
    }

    // If overwriting, delete existing accounts (only if no transactions)
    if (overwriteExisting && existingAccounts.length > 0) {
      const fullAccounts = await prisma.account.findMany({
        where: { tenantId: user.tenantId }
      });

      for (const account of fullAccounts) {
          const [journalCount, transactionCount] = await Promise.all([
            prisma.journalEntryLine.count({
              where: {
                accountId: account.id,
                journalEntry: {
                  status: 'Posted'
                }
              }
            }),
            prisma.transactionLine.count({
              where: {
                accountId: account.id,
                transaction: {
                  status: 'posted'
                }
              }
            })
          ]);
          const hasTransactions = journalCount > 0 || transactionCount > 0;

        if (!hasTransactions) {
          await prisma.account.delete({
            where: { id: account.id }
          });
        }
      }
    }

    // Create a map of parent accounts for hierarchy
    const accountMap = new Map();
    const createdAccounts = [];

    // First pass: Create all accounts without parents
    for (const template of STANDARD_COA_TEMPLATE) {
      if (!template.parentCode) {
        const account = await prisma.account.create({
          data: {
            accountCode: template.code,
            accountName: template.name,
            accountType: template.type,
            accountSubtype: template.subtype || null,
            normalBalance: template.normalBalance,
            parentAccountId: null,
            description: null,
            isActive: true,
            isSystem: true,
            tenantId: user.tenantId,
            balance: 0
          }
        });
        accountMap.set(template.code, account.id);
        createdAccounts.push(account);
      }
    }

    // Second pass: Create child accounts
    for (const template of STANDARD_COA_TEMPLATE) {
      if (template.parentCode) {
        const parentId = accountMap.get(template.parentCode);
        if (parentId) {
          const account = await prisma.account.create({
            data: {
              accountCode: template.code,
              accountName: template.name,
              accountType: template.type,
              accountSubtype: template.subtype || null,
              normalBalance: template.normalBalance,
              parentAccountId: parentId,
              description: null,
              isActive: true,
              isSystem: true,
              tenantId: user.tenantId,
              balance: 0
            }
          });
          accountMap.set(template.code, account.id);
          createdAccounts.push(account);
        }
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${createdAccounts.length} accounts`,
      accountsCreated: createdAccounts.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing COA template:', error);
    return NextResponse.json(
      { error: 'Failed to import COA template', details: error.message },
      { status: 500 }
    );
  }
}

