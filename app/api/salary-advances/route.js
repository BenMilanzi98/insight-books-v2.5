// app/api/salary-advances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateReferenceNumber } from '@/lib/journalService';
import { getPaymentAccount } from '@/lib/transactionJournalHelpers';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

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

      // Get or create "Salary Advance Receivable" asset account
      // Salary advances are receivables (assets), not expenses
      let receivableAccount = await tx.account.findFirst({
        where: {
          tenantId: user.tenantId,
          OR: [
            { accountName: { contains: 'Salary Advance Receivable', mode: 'insensitive' } },
            { accountName: { contains: 'Advance Salary Receivable', mode: 'insensitive' } },
            { accountName: { contains: 'Employee Advance Receivable', mode: 'insensitive' } }
          ],
          accountType: 'Asset',
          isActive: true
        }
      });

      if (!receivableAccount) {
        // Create "Salary Advance Receivable" account (Asset)
        receivableAccount = await tx.account.create({
          data: {
            tenantId: user.tenantId,
            accountCode: '1300',
            accountName: 'Salary Advance Receivable',
            accountType: 'Asset',
            isActive: true,
            description: 'Asset account for tracking salary advances given to employees (receivables)'
          }
        });
      }

      // Get payment account - handle both account ID and payment method name
      let paymentAccount;
      
      // First, try to find account by ID (in case frontend sends account ID)
      if (selectedPaymentMethod) {
        try {
          paymentAccount = await tx.account.findFirst({
            where: {
              id: selectedPaymentMethod,
              tenantId: user.tenantId,
              isActive: true,
              accountType: 'Asset' // Payment accounts should be assets
            }
          });
        } catch (error) {
          // If lookup by ID fails, it's probably not an ID, continue to payment method lookup
          console.log('Payment method is not an account ID, trying payment method lookup');
        }
      }
      
      // If not found by ID, try payment method name lookup
      if (!paymentAccount) {
        try {
          paymentAccount = await getPaymentAccount(user.tenantId, selectedPaymentMethod, tx);
        } catch (error) {
          console.error('Error getting payment account:', error);
          throw new Error(`Payment account not found for method "${selectedPaymentMethod}". Please ensure the account exists and is active in your chart of accounts.`);
        }
      }
      
      if (!paymentAccount) {
        throw new Error('Payment account not found. Please set up your chart of accounts.');
      }

      // Create journal entry for the advance
      // Debit: Salary Advance Receivable (Asset) - increases receivable
      // Credit: Cash/Payment Account - decreases cash
      const entryDate = new Date(advanceDate);
      await assertPeriodOpen(user.tenantId, entryDate, tx);
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
            ],
          },
        },
      });

      // Update payment account balance (credit = decrease)
      await tx.account.update({
        where: { id: paymentAccount.id },
        data: {
          balance: {
            decrement: advanceAmount
          }
        }
      });

      // Update receivable account balance (debit = increase)
      await tx.account.update({
        where: { id: receivableAccount.id },
        data: {
          balance: {
            increment: advanceAmount
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

