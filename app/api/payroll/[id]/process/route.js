// app/api/payroll/[id]/process/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Process a payroll (update status to Completed and set payment date)
 */
export async function POST(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // In Next.js App Router, we access the ID directly from params
    const payrollId = params.id;
    const body = await request.json();
    
    // Check if payroll exists
    const existingPayroll = await prisma.payroll.findUnique({
      where: { 
        id: payrollId
      },
      include: {
        employee: true,
      }
    });
    
    if (!existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    // Check if payroll is already processed
    if (existingPayroll.status === 'Processed') {
      return NextResponse.json(
        { error: 'Payroll has already been processed' },
        { status: 400 }
      );
    }
    
    // Get payment details from request or use defaults
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    const paymentMethod = body.paymentMethod || 'Bank Transfer';
    const notes = body.notes || `Processed on ${new Date().toLocaleDateString()}`;
    
    // Update the payroll status from Draft to Processed
    const updatedPayroll = await prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status: 'Processed',
        paymentDate: paymentDate,
        notes: `${existingPayroll.notes ? existingPayroll.notes + '\n' : ''}${notes}`
      },
      include: {
        employee: true,
      }
    });
    
    // Create a transaction record - commenting out for now as this requires Transaction and JournalEntry models
    // We'll add a placeholder for now to avoid errors
    const payment = {
      id: `payment-${Date.now()}`, // Generate a temporary ID
      date: paymentDate,
      description: `Payroll payment for ${existingPayroll.employee.name} (${existingPayroll.periodStart.toLocaleDateString()} - ${existingPayroll.periodEnd.toLocaleDateString()})`,
    };
    
    /* Uncomment and modify this when Transaction and JournalEntry models are available
    const payment = await prisma.transaction.create({
      data: {
        date: paymentDate,
        description: `Payroll payment for ${existingPayroll.employee.name} (${existingPayroll.periodStart.toLocaleDateString()} - ${existingPayroll.periodEnd.toLocaleDateString()})`,
        tenantId: user.tenantId,
        // Create journal entries for double-entry accounting
        entries: {
          create: [
            {
              // Debit Salary Expense
              accountId: 'salary-expense-account-id', // Replace with actual account ID
              debit: existingPayroll.netPay,
              credit: 0,
              description: 'Salary Expense'
            },
            {
              // Credit Cash or Bank
              accountId: 'cash-account-id', // Replace with actual account ID
              debit: 0,
              credit: existingPayroll.netPay,
              description: 'Cash Payment'
            }
          ]
        }
      }
    });
    */
    
    // Create audit log - commenting out for now as we may need to adjust based on schema
    /* 
    await prisma.auditLog.create({
      data: {
        action: 'PAYROLL_PROCESSED',
        entityType: 'PAYROLL',
        entityId: id,
        userId: user.id,
        details: JSON.stringify({
          employeeName: existingPayroll.employee.name,
          netPay: existingPayroll.netPay,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          transactionId: payment.id
        }),
      },
    });
    */
    
    // Log the action instead
    console.log('Audit log would be created:', {
      action: 'PAYROLL_PROCESSED',
      entityType: 'PAYROLL',
      entityId: id,
      userId: user.id,
      details: {
        employeeName: existingPayroll.employee.name,
        netPay: existingPayroll.netPay,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        transactionId: payment.id
      }
    });
    
    return NextResponse.json({
      message: 'Payroll processed successfully',
      payroll: updatedPayroll,
      transaction: payment
    });
  } catch (error) {
    console.error(`Error processing payroll:`, error);
    return NextResponse.json(
      { error: `Failed to process payroll: ${error.message}` },
      { status: 500 }
    );
  }
}