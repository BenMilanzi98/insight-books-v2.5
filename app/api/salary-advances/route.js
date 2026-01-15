// app/api/salary-advances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateReferenceNumber, getPaymentAccount } from '@/lib/transactionJournalHelpers';

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
    const months = repaymentMonths || 1;
    const monthlyDeduction = advanceAmount / months;
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

      // Get or create "Advance Salary" expense account
      let expenseAccount = await tx.account.findFirst({
        where: {
          tenantId: user.tenantId,
          accountName: { contains: 'Advance Salary', mode: 'insensitive' },
          accountType: 'Expense',
          isActive: true
        }
      });

      if (!expenseAccount) {
        // Try to find any salary-related expense account
        expenseAccount = await tx.account.findFirst({
          where: {
            tenantId: user.tenantId,
            accountName: { contains: 'Salary', mode: 'insensitive' },
            accountType: 'Expense',
            isActive: true
          }
        });
      }

      if (!expenseAccount) {
        // Create "Advance Salary Expense" account
        expenseAccount = await tx.account.create({
          data: {
            tenantId: user.tenantId,
            accountCode: '6205',
            accountName: 'Advance Salary Expense',
            accountType: 'Expense',
            isActive: true,
            description: 'Expense account for salary advances given to employees'
          }
        });
      }

      // Get payment account using helper function
      const paymentAccount = await getPaymentAccount(user.tenantId, selectedPaymentMethod, tx);

      if (!paymentAccount) {
        throw new Error('Payment account not found. Please set up your chart of accounts.');
      }

      // Create journal entry for the advance
      const entryDate = new Date(advanceDate);
      const referenceNumber = await generateReferenceNumber(tx, user.tenantId, entryDate);

      await tx.transaction.create({
        data: {
          tenantId: user.tenantId,
          date: entryDate,
          reference: referenceNumber,
          description: `Salary Advance: ${employee.name}${reference ? ` (${reference})` : ''}`,
          entryType: 'Regular',
          status: 'posted',
          sourceType: 'SalaryAdvance',
          sourceId: advance.id,
          createdById: user.id,
          postedById: user.id,
          postedDate: new Date(),
          lines: {
            create: [
              {
                lineNumber: 1,
                accountId: expenseAccount.id,
                debitAmount: advanceAmount,
                creditAmount: 0,
                description: `Advance Salary: ${employee.name}`,
              },
              {
                lineNumber: 2,
                accountId: paymentAccount.id,
                debitAmount: 0,
                creditAmount: advanceAmount,
                description: `Payment for salary advance: ${employee.name}`,
              },
            ],
          },
        },
      });

      // Update payment account balance
      await tx.account.update({
        where: { id: paymentAccount.id },
        data: {
          balance: {
            decrement: advanceAmount
          }
        }
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

