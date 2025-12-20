// app/api/accounting/validate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { validateTransactionBalance, validateBalanceSheetEquation } from '@/lib/accountingValidation';

// GET - Validate all accounting entries
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')) : null;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')) : null;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.gte = startDate;
      if (endDate) dateFilter.date.lte = endDate;
    }

    // Get all posted transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'posted',
        ...dateFilter
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
      }
    });

    // Validate each transaction
    const validationResults = {
      totalTransactions: transactions.length,
      validTransactions: 0,
      invalidTransactions: 0,
      errors: [],
      transactions: []
    };

    for (const transaction of transactions) {
      const lines = transaction.lines.map(line => ({
        lineNumber: line.lineNumber,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        accountId: line.accountId
      }));

      const validation = validateTransactionBalance(lines);
      
      if (validation.isValid) {
        validationResults.validTransactions++;
      } else {
        validationResults.invalidTransactions++;
        validationResults.errors.push({
          transactionId: transaction.id,
          reference: transaction.reference,
          description: transaction.description,
          date: transaction.date,
          error: validation.error
        });
      }

      validationResults.transactions.push({
        id: transaction.id,
        reference: transaction.reference,
        description: transaction.description,
        date: transaction.date,
        isValid: validation.isValid,
        totalDebits: validation.totalDebits,
        totalCredits: validation.totalCredits,
        difference: validation.difference
      });
    }

    // Calculate balance sheet totals
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      select: {
        id: true,
        accountType: true,
        balance: true
      }
    });

    const assetTotal = accounts
      .filter(acc => acc.accountType === 'Asset')
      .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    const liabilityTotal = accounts
      .filter(acc => acc.accountType === 'Liability')
      .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    const equityTotal = accounts
      .filter(acc => acc.accountType === 'Equity')
      .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    const balanceSheetValidation = validateBalanceSheetEquation({
      assetTotal,
      liabilityTotal,
      equityTotal
    });

    return NextResponse.json({
      success: true,
      data: {
        transactionValidation: validationResults,
        balanceSheetValidation: {
          isValid: balanceSheetValidation.isValid,
          assetTotal,
          liabilityTotal,
          equityTotal,
          rightSideTotal: balanceSheetValidation.rightSideTotal,
          difference: balanceSheetValidation.difference,
          error: balanceSheetValidation.error
        },
        summary: {
          allTransactionsValid: validationResults.invalidTransactions === 0,
          balanceSheetBalances: balanceSheetValidation.isValid,
          overallValid: validationResults.invalidTransactions === 0 && balanceSheetValidation.isValid
        }
      }
    });
  } catch (error) {
    console.error('Error validating accounting entries:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate accounting entries' },
      { status: 500 }
    );
  }
}










