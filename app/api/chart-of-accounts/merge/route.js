import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { canUpdateChartOfAccount } from '@/lib/chartOfAccountsAccess';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

const normalizeAccountType = (value) => {
  if (!value) return value;
  const normalized = value.toString().trim();
  const upper = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return ACCOUNT_TYPES.includes(upper) ? upper : normalized;
};

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required or no tenant associated' }, { status: 401 });
    }

    try {
      const { assertTenantCoaUnlocked } = await import('@/lib/coaTenantLock');
      await assertTenantCoaUnlocked(user.tenantId);
    } catch (lockErr) {
      if (lockErr?.code === 'COA_TENANT_LOCKED') {
        return NextResponse.json({ error: lockErr.message, code: lockErr.code }, { status: 423 });
      }
      throw lockErr;
    }

    if (!canUpdateChartOfAccount(user)) {
      return NextResponse.json(
        { error: 'Access denied. accounts.update permission required.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { sourceAccountId, targetAccountId } = body || {};

    if (!sourceAccountId || !targetAccountId) {
      return NextResponse.json({ error: 'sourceAccountId and targetAccountId are required' }, { status: 400 });
    }

    if (sourceAccountId === targetAccountId) {
      return NextResponse.json({ error: 'Source and target accounts must be different' }, { status: 400 });
    }

    const [source, target] = await Promise.all([
      prisma.account.findFirst({ where: { id: sourceAccountId, tenantId: user.tenantId } }),
      prisma.account.findFirst({ where: { id: targetAccountId, tenantId: user.tenantId } })
    ]);

    if (!source || !target) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (source.mergedIntoAccountId) {
      return NextResponse.json(
        { error: 'This account has already been merged into another account and is kept for audit only.' },
        { status: 400 }
      );
    }

    if (target.mergedIntoAccountId) {
      return NextResponse.json(
        { error: 'Cannot merge into an account that is itself merged into another. Pick the surviving account instead.' },
        { status: 400 }
      );
    }

    // Keep this conservative: merging accounts with different semantics can break reports/balances.
    const sourceType = normalizeAccountType(source.accountType);
    const targetType = normalizeAccountType(target.accountType);
    if (sourceType && targetType && sourceType !== targetType) {
      return NextResponse.json({ error: 'Cannot merge accounts with different account types' }, { status: 400 });
    }

    if (source.normalBalance && target.normalBalance && source.normalBalance !== target.normalBalance) {
      return NextResponse.json({ error: 'Cannot merge accounts with different normal balance types' }, { status: 400 });
    }

    // Rewire + deactivate in one transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1) Merge balances (best-effort; balances are also reflected through transaction lines/history)
      await tx.account.update({
        where: { id: target.id },
        data: { balance: { increment: source.balance || 0 } }
      });

      await tx.account.update({
        where: { id: source.id },
        data: {
          balance: 0,
          isActive: false,
          // Logical merge: row and code remain for audit; lists/pickers hide sources via mergedIntoAccountId.
          mergedIntoAccountId: target.id,
        },
      });

      // 2) Move hierarchy children to the target account
      await tx.account.updateMany({
        where: { parentAccountId: source.id, tenantId: user.tenantId },
        data: { parentAccountId: target.id }
      });

      // 3) Rewire transaction lines (GL)
      const transactionLines = await tx.transactionLine.updateMany({
        where: {
          accountId: source.id,
          transaction: { tenantId: user.tenantId }
        },
        data: { accountId: target.id }
      });

      // 4) Rewire journal entry lines
      const journalEntryLines = await tx.journalEntryLine.updateMany({
        where: {
          accountId: source.id,
          journalEntry: { tenantId: user.tenantId }
        },
        data: { accountId: target.id }
      });

      const journalEntries = await tx.journalEntry.updateMany({
        where: {
          accountId: source.id,
          tenantId: user.tenantId
        },
        data: { accountId: target.id }
      });

      // 5) Rewire invoice/sale line account references (A/R and revenue items)
      const invoiceItems = await tx.invoiceItem.updateMany({
        where: {
          accountId: source.id,
          invoice: { tenantId: user.tenantId }
        },
        data: { accountId: target.id }
      });

      const saleItems = await tx.saleItem.updateMany({
        where: {
          accountId: source.id,
          sale: { tenantId: user.tenantId }
        },
        data: { accountId: target.id }
      });

      // 6) Rewire expenses (expense account and source/payment account)
      const expenseExpenseAccounts = await tx.expense.updateMany({
        where: { tenantId: user.tenantId, expenseAccountId: source.id },
        data: { expenseAccountId: target.id }
      });

      const expenseSourceAccounts = await tx.expense.updateMany({
        where: { tenantId: user.tenantId, sourceAccountId: source.id },
        data: { sourceAccountId: target.id }
      });

      // 7) Rewire supplier-bill expense accounts
      const supplierBillItems = await tx.supplierBillItem.updateMany({
        where: {
          expenseAccountId: source.id,
          bill: { tenantId: user.tenantId }
        },
        data: { expenseAccountId: target.id }
      });

      // 8) Rewire recurring expense accounts
      const recurringExpenses = await tx.recurringExpense.updateMany({
        where: {
          tenantId: user.tenantId,
          expenseAccountId: source.id
        },
        data: { expenseAccountId: target.id }
      });

      // 9) Rewire Products (COGS + Inventory accounts)
      const productsCogs = await tx.product.updateMany({
        where: { tenantId: user.tenantId, cogsAccountId: source.id },
        data: { cogsAccountId: target.id }
      });

      const productsInventory = await tx.product.updateMany({
        where: { tenantId: user.tenantId, inventoryAccountId: source.id },
        data: { inventoryAccountId: target.id }
      });

      // 10) Rewire taxes and expense categories
      const taxTypes = await tx.taxType.updateMany({
        where: { tenantId: user.tenantId, accountId: source.id },
        data: { accountId: target.id }
      });

      const expenseCategories = await tx.expenseCategory.updateMany({
        where: { tenantId: user.tenantId, accountId: source.id },
        data: { accountId: target.id }
      });

      // 11) Rewire budgets
      const budgetItems = await tx.legacyBudgetItem.updateMany({
        where: { budget: { tenantId: user.tenantId }, accountId: source.id },
        data: { accountId: target.id }
      });

      await tx.budgetLine.updateMany({
        where: { budget: { tenantId: user.tenantId }, accountId: source.id },
        data: { accountId: target.id }
      });

      await tx.forecastLine.updateMany({
        where: { forecast: { tenantId: user.tenantId }, accountId: source.id },
        data: { accountId: target.id }
      });

      // 12) Rewire payment/bank/equity account COA links
      const paymentAccounts = await tx.paymentAccount.updateMany({
        where: { tenantId: user.tenantId, coaAccountId: source.id },
        data: { coaAccountId: target.id }
      });

      const bankAccounts = await tx.bankAccount.updateMany({
        where: { tenantId: user.tenantId, coaAccountId: source.id },
        data: { coaAccountId: target.id }
      });

      const equityAccounts = await tx.equityAccount.updateMany({
        where: { tenantId: user.tenantId, coaAccountId: source.id },
        data: { coaAccountId: target.id }
      });

      // 13) Merge AccountBalanceHistory snapshots (sum per periodDate)
      const sourceHistories = await tx.accountBalanceHistory.findMany({
        where: { accountId: source.id },
        select: {
          periodDate: true,
          openingBalance: true,
          totalDebits: true,
          totalCredits: true,
          closingBalance: true
        }
      });

      for (const h of sourceHistories) {
        await tx.accountBalanceHistory.upsert({
          where: {
            accountId_periodDate: {
              accountId: target.id,
              periodDate: h.periodDate
            }
          },
          create: {
            accountId: target.id,
            periodDate: h.periodDate,
            openingBalance: h.openingBalance || 0,
            totalDebits: h.totalDebits || 0,
            totalCredits: h.totalCredits || 0,
            closingBalance: h.closingBalance || 0
          },
          update: {
            openingBalance: { increment: h.openingBalance || 0 },
            totalDebits: { increment: h.totalDebits || 0 },
            totalCredits: { increment: h.totalCredits || 0 },
            closingBalance: { increment: h.closingBalance || 0 }
          }
        });
      }

      await tx.accountBalanceHistory.deleteMany({ where: { accountId: source.id } });

      // 14) Keep an audit trail
      await tx.auditLog.create({
        data: {
          action: 'MERGE_CHART_OF_ACCOUNTS',
          entityType: 'ACCOUNT',
          entityId: target.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            sourceAccountId: source.id,
            targetAccountId: target.id,
            mergedIntoAccountId: target.id,
          })
        }
      });

      return {
        transactionLines: transactionLines.count,
        journalEntryLines: journalEntryLines.count,
        journalEntries: journalEntries.count,
        invoiceItems: invoiceItems.count,
        saleItems: saleItems.count,
        expenseExpenseAccounts: expenseExpenseAccounts.count,
        expenseSourceAccounts: expenseSourceAccounts.count,
        supplierBillItems: supplierBillItems.count,
        recurringExpenses: recurringExpenses.count,
        productsCogs: productsCogs.count,
        productsInventory: productsInventory.count,
        taxTypes: taxTypes.count,
        expenseCategories: expenseCategories.count,
        budgetItems: budgetItems.count,
        paymentAccounts: paymentAccounts.count,
        bankAccounts: bankAccounts.count,
        equityAccounts: equityAccounts.count,
        sourceHistoriesMoved: sourceHistories.length
      };
    });

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error('chart-of-accounts merge error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to merge chart of accounts' },
      { status: 500 }
    );
  }
}

