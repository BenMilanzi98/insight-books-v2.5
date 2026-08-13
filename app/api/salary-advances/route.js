// app/api/salary-advances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertAccountsAllowDirectPosting } from '@/lib/coaDirectPostingEligibility';
import { resolveSalaryAdvanceReceivableAccount } from '@/lib/salaryAdvanceGlAccount';
import { postSalaryAdvanceAccounting } from '@/lib/accountingV2/adapters/remainingAdapters.js';

/**
 * GET - Get all salary advances for the tenant
 */
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    const where = {
      tenantId: user.tenantId
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    const advances = await prisma.salaryAdvance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            grossSalary: true,
            salary: true
          }
        },
        deductions: {
          orderBy: {
            deductionDate: 'desc'
          }
        }
      },
      orderBy: {
        advanceDate: 'desc'
      }
    });

    return NextResponse.json({ advances });

  } catch (error) {
    console.error('Error fetching salary advances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary advances', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new salary advance
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { employeeId, amount, advanceDate, repaymentMonths, reference, notes, paymentMethod } = body;

    if (!employeeId || !amount || !advanceDate) {
      return NextResponse.json(
        { error: 'Employee ID, amount, and advance date are required' },
        { status: 400 }
      );
    }

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        tenantId: true
      }
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const advanceAmount = Number(amount);
    const months = Number(repaymentMonths || 1);
    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      return NextResponse.json(
        { error: 'Advance amount must be greater than zero' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(months) || months <= 0) {
      return NextResponse.json(
        { error: 'Repayment months must be a positive whole number' },
        { status: 400 }
      );
    }
    const monthlyDeduction = Math.round((advanceAmount / months) * 100) / 100;
    const selectedPaymentMethod = paymentMethod || 'Cash';

    // Create advance and journal entry in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create advance
      const advance = await tx.salaryAdvance.create({
        data: {
          employeeId,
          tenantId: user.tenantId,
          amount: advanceAmount,
          advanceDate: new Date(advanceDate),
          repaymentMonths: months,
          monthlyDeduction: monthlyDeduction,
          totalDeducted: 0,
          outstandingAmount: advanceAmount,
          status: 'Active',
          reference: reference || null,
          notes: notes || null
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeId: true
            }
          }
        }
      });

      // Salary advances are receivables (assets), not expenses.
      const receivableAccount = await resolveSalaryAdvanceReceivableAccount(user.tenantId, tx);

      let paymentAccount;
      try {
        paymentAccount = await getAccountForPaymentMethod(user.tenantId, selectedPaymentMethod, tx);
      } catch (error) {
        console.error('Error getting payment account:', error);
        throw new Error(`Payment account not found for method "${selectedPaymentMethod}". Please ensure the account exists and is active in your chart of accounts.`);
      }

      await assertAccountsAllowDirectPosting([receivableAccount.id, paymentAccount.id], tx);

      // Create journal entry for the advance
      // Debit: Salary Advance Receivable (Asset) - increases receivable
      // Credit: Cash/Payment Account - decreases cash
      const entryDate = new Date(advanceDate);
      await assertPeriodOpen(user.tenantId, entryDate, tx);

      const advanceLines = [
        {
          lineNumber: 1,
          accountId: receivableAccount.id,
          debitAmount: advanceAmount,
          creditAmount: 0,
          description: `Salary Advance Receivable: ${employee.name}`,
        },
        {
          lineNumber: 2,
          accountId: paymentAccount.id,
          debitAmount: 0,
          creditAmount: advanceAmount,
          description: `Payment for salary advance: ${employee.name}`,
        },
      ];
      const advanceDesc = `Salary Advance: ${employee.name}${reference ? ` (${reference})` : ''}`;
      await postSalaryAdvanceAccounting({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        advanceId: advance.id,
        amount: advanceAmount,
        date: entryDate,
        description: advanceDesc,
        lines: advanceLines,
      });

      return advance;
    });

    return NextResponse.json({ advance: result });

  } catch (error) {
    console.error('Error creating salary advance:', error);
    return NextResponse.json(
      { error: 'Failed to create salary advance', details: error.message },
      { status: 500 }
    );
  }
}

