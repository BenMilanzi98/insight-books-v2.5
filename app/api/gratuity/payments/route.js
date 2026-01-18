// app/api/gratuity/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { createExpenseJournalEntry } from '@/lib/transactionJournalHelpers';

/**
 * POST - Record a gratuity payment
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
    const { gratuityAccountId, amount, paymentDate, reference, notes, paymentMethod } = body;
    const method = (paymentMethod || 'cash').toString();

    if (!gratuityAccountId || !amount || !paymentDate) {
      return NextResponse.json(
        { error: 'Gratuity account ID, amount, and payment date are required' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Verify gratuity account belongs to tenant
      const gratuityAccount = await tx.gratuityAccount.findUnique({
        where: { id: gratuityAccountId },
        include: {
          employee: {
            select: { id: true, name: true, employeeId: true }
          }
        }
      });

      if (!gratuityAccount || gratuityAccount.tenantId !== user.tenantId) {
        throw new Error('Gratuity account not found');
      }

      const payAmount = Number(amount);
      const payDate = new Date(paymentDate);

      // Create gratuity payment record
      const gratuityPayment = await tx.gratuityPayment.create({
        data: {
          gratuityAccountId,
          amount: payAmount,
          paymentDate: payDate,
          reference: reference || null,
          notes: notes || null
        }
      });

      // Update gratuity account totals
      const totalPaid = (Number(gratuityAccount.totalPaid) || 0) + payAmount;
      const outstandingAmount = Math.max(0, (Number(gratuityAccount.totalAccrued) || 0) - totalPaid);

      const updatedAccount = await tx.gratuityAccount.update({
        where: { id: gratuityAccountId },
        data: {
          totalPaid,
          outstandingAmount
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

      // Create an Expense so it shows in /expenses and dashboard expense metrics
      const employeeName = gratuityAccount.employee?.name || 'Employee';
      const employeeNumber = gratuityAccount.employee?.employeeId || 'N/A';
      const expenseDescription = `Gratuity Payment - ${employeeName} (${employeeNumber})`;

      const expense = await tx.expense.create({
        data: {
          description: expenseDescription,
          amount: payAmount,
          date: payDate,
          category: 'Gratuity',
          paymentMethod: method,
          merchant: 'Gratuity',
          status: 'Approved',
          notes: JSON.stringify({
            type: 'GratuityPayment',
            gratuityAccountId,
            gratuityPaymentId: gratuityPayment.id,
            employeeId: gratuityAccount.employeeId,
            reference: reference || null,
            notes: notes || null
          }),
          submittedById: user.id,
          tenantId: user.tenantId,
          paymentStatus: 'Fully paid',
          paidAmount: payAmount,
          paymentReference: reference || `GRAT-${gratuityPayment.id}`
        }
      });

      await tx.payment.create({
        data: {
          expenseId: expense.id,
          amount: payAmount,
          paymentDate: payDate,
          paymentMethod: method,
          reference: reference || expenseDescription,
          status: 'Completed',
          tenantId: user.tenantId,
          type: 'expense',
          sourceAccount: method || null
        }
      });

      // Update account balance (drives dashboard cashflow/account balances)
      await updateAccountBalance(user.tenantId, method, payAmount, 'subtract', tx);

      // Best-effort journal entry
      try {
        await createExpenseJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          expenseId: expense.id,
          expenseDate: payDate,
          amount: payAmount,
          category: 'Gratuity',
          paymentMethod: method,
          tx
        });
      } catch (journalError) {
        console.warn('Gratuity expense journal entry failed (continuing):', journalError?.message || journalError);
      }

      return { gratuityPayment, updatedAccount, expense };
    });

    return NextResponse.json({
      payment: result.gratuityPayment,
      gratuityAccount: result.updatedAccount,
      expense: result.expense
    });

  } catch (error) {
    console.error('Error recording gratuity payment:', error);
    return NextResponse.json(
      { error: 'Failed to record gratuity payment', details: error.message },
      { status: error.message === 'Gratuity account not found' ? 404 : 500 }
    );
  }
}

