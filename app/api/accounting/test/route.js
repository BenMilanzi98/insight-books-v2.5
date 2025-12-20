// app/api/accounting/test/route.js
// Simple test endpoint for Phase 1 validation
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { validateTransactionBalance, validateBalanceSheetEquation } from '@/lib/accountingValidation';
import { getAccountBalanceDetails, recalculateAllAccountBalances } from '@/lib/accountBalanceService';

// GET - Run Phase 1 validation tests
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

    const testResults = {
      timestamp: new Date().toISOString(),
      tenantId: user.tenantId,
      tests: {}
    };

    // Test 1: Validate transactions
    try {
      const transactions = await prisma.transaction.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'posted'
        },
        include: {
          lines: true
        },
        take: 100 // Limit for performance
      });

      let validCount = 0;
      let invalidCount = 0;
      const errors = [];

      for (const transaction of transactions) {
        const lines = transaction.lines.map(line => ({
          lineNumber: line.lineNumber,
          debitAmount: line.debitAmount,
          creditAmount: line.creditAmount
        }));

        const validation = validateTransactionBalance(lines);
        
        if (validation.isValid) {
          validCount++;
        } else {
          invalidCount++;
          errors.push({
            transactionId: transaction.id,
            reference: transaction.reference,
            description: transaction.description,
            error: validation.error
          });
        }
      }

      // Check for orphaned transactions (no lines)
      const orphanedTransactions = transactions.filter(tx => !tx.lines || tx.lines.length === 0);
      const orphanedCount = orphanedTransactions.length;

      testResults.tests.transactionValidation = {
        passed: invalidCount === 0 && orphanedCount === 0,
        totalTransactions: transactions.length,
        validTransactions: validCount,
        invalidTransactions: invalidCount,
        orphanedTransactions: orphanedCount,
        errors: errors.slice(0, 10), // Limit errors shown
        orphaned: orphanedTransactions.slice(0, 10).map(tx => ({
          transactionId: tx.id,
          reference: tx.reference,
          description: tx.description,
          date: tx.date
        })),
        fixSuggestion: orphanedCount > 0 
          ? `Found ${orphanedCount} orphaned transaction(s) (no lines). Use GET /api/accounting/fix-orphaned to view them, then POST /api/accounting/fix-orphaned to fix.`
          : null
      };
    } catch (error) {
      testResults.tests.transactionValidation = {
        passed: false,
        error: error.message
      };
    }

    // Test 2: Validate balance sheet
    try {
      const accounts = await prisma.account.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true
        },
        select: {
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

      testResults.tests.balanceSheetValidation = {
        passed: balanceSheetValidation.isValid,
        assetTotal,
        liabilityTotal,
        equityTotal,
        rightSideTotal: balanceSheetValidation.rightSideTotal,
        difference: balanceSheetValidation.difference,
        error: balanceSheetValidation.error
      };
    } catch (error) {
      testResults.tests.balanceSheetValidation = {
        passed: false,
        error: error.message
      };
    }

    // Test 3: Test account balance calculation
    try {
      const testAccount = await prisma.account.findFirst({
        where: {
          tenantId: user.tenantId,
          isActive: true
        }
      });

      if (testAccount) {
        const balanceDetails = await getAccountBalanceDetails(
          testAccount.id,
          user.tenantId,
          null,
          prisma
        );
        
        testResults.tests.accountBalanceCalculation = {
          passed: true,
          accountName: balanceDetails.account.accountName,
          balance: balanceDetails.balance,
          transactionCount: balanceDetails.transactionCount
        };
      } else {
        testResults.tests.accountBalanceCalculation = {
          passed: false,
          error: 'No accounts found'
        };
      }
    } catch (error) {
      testResults.tests.accountBalanceCalculation = {
        passed: false,
        error: error.message
      };
    }

    // Summary
    const allTestsPassed = Object.values(testResults.tests).every(test => test.passed === true);
    testResults.summary = {
      allTestsPassed,
      totalTests: Object.keys(testResults.tests).length,
      passedTests: Object.values(testResults.tests).filter(test => test.passed === true).length
    };

    return NextResponse.json({
      success: true,
      message: allTestsPassed 
        ? 'All Phase 1 tests passed! ✅' 
        : 'Some tests failed. Please review the results.',
      data: testResults
    });
  } catch (error) {
    console.error('Error running Phase 1 tests:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to run tests',
        data: null
      },
      { status: 500 }
    );
  }
}

