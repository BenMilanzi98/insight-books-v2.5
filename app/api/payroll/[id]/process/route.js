// app/api/payroll/[id]/process/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { resolveCanonicalSalaryExpenseAccount } from '@/lib/accountingMappingRules';
import { postApprovedExpenseJournalIfMissing } from '@/lib/expenseGlPosting';

const PAYROLL_EXPENSE_NOTE_PREFIX = 'payrollDashboardExpense:';

function computePayrollOperatingExpense(p) {
  const gross = Number(p.grossPay) || 0;
  const basic = Number(p.basicSalary) || 0;
  const adds = Number(p.additions) || 0;
  const net = Number(p.netPay) || 0;
  const deds = Number(p.deductions) || 0;
  if (gross > 0) return gross + adds;
  const fromBase = basic + adds;
  if (fromBase > 0) return fromBase;
  if (net > 0) return net + deds;
  return 0;
}

/**
 * POST - Process a payroll (update status to Processed and set payment date)
 * Creates an Approved Expense so financial dashboard operating totals include payroll immediately.
 */
export async function POST(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const params = context.params;
    const resolved = typeof params?.then === 'function' ? await params : params;
    const payrollId = resolved?.id;

    if (!payrollId) {
      return NextResponse.json({ error: 'Invalid payroll id' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        id: payrollId,
        tenantId: user.tenantId,
      },
      include: {
        employee: true,
      },
    });

    if (!existingPayroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    if (existingPayroll.status === 'Processed') {
      return NextResponse.json(
        { error: 'Payroll has already been processed' },
        { status: 400 }
      );
    }

    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    const paymentMethod = body.paymentMethod || 'Bank Transfer';
    const notes = body.notes || `Processed on ${new Date().toLocaleDateString()}`;

    const expenseAmount = computePayrollOperatingExpense(existingPayroll);
    if (expenseAmount <= 0) {
      return NextResponse.json(
        { error: 'Payroll has no positive amount to post as operating expense.' },
        { status: 400 }
      );
    }

    const duplicateMarker = `${PAYROLL_EXPENSE_NOTE_PREFIX}${payrollId}`;
    const already = await prisma.expense.findFirst({
      where: {
        tenantId: user.tenantId,
        notes: { contains: duplicateMarker },
        isDeleted: false,
      },
      select: { id: true },
    });
    if (already) {
      return NextResponse.json(
        { error: 'Dashboard expense for this payroll already exists.' },
        { status: 400 }
      );
    }

    const salaryAccount = await resolveCanonicalSalaryExpenseAccount(user.tenantId, prisma);

    const result = await prisma.$transaction(async (tx) => {
      const updatedPayroll = await tx.payroll.update({
        where: { id: payrollId },
        data: {
          status: 'Processed',
          paymentDate,
          notes: `${existingPayroll.notes ? `${existingPayroll.notes}\n` : ''}${notes}`,
        },
        include: {
          employee: true,
        },
      });

      const expense = await tx.expense.create({
        data: {
          description: `Payroll — ${existingPayroll.employee.name} (${existingPayroll.periodStart.toLocaleDateString()} – ${existingPayroll.periodEnd.toLocaleDateString()})`,
          amount: expenseAmount,
          date: paymentDate,
          category: 'Salary',
          expenseAccountId: salaryAccount.id,
          employeeId: existingPayroll.employeeId,
          paymentMethod,
          status: 'Approved',
          paymentStatus: 'Fully paid',
          paidAmount: expenseAmount,
          submittedById: user.id,
          tenantId: user.tenantId,
          notes: `${duplicateMarker} | Total payroll cost for dashboard operating expenses.`,
        },
      });

      await postApprovedExpenseJournalIfMissing({
        tx,
        tenantId: user.tenantId,
        userId: user.id,
        expense,
      });

      await tx.auditLog.create({
        data: {
          action: 'PAYROLL_PROCESSED',
          entityType: 'PAYROLL',
          entityId: payrollId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            employeeName: existingPayroll.employee.name,
            netPay: existingPayroll.netPay,
            operatingExpenseRecorded: expenseAmount,
            paymentDate,
            paymentMethod,
          }),
        },
      });

      return updatedPayroll;
    });

    return NextResponse.json({
      message: 'Payroll processed successfully',
      payroll: result,
    });
  } catch (error) {
    console.error('Error processing payroll:', error);
    return NextResponse.json(
      { error: `Failed to process payroll: ${error.message}` },
      { status: 500 }
    );
  }
}
