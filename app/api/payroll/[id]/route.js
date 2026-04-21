// app/api/payroll/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  reversePayroll,
  resolvePostedPayrollJournalState,
} from '@/lib/transactionReversalService';
import { normalizePayrollMonthPeriod } from '@/lib/dateUtils';

/**
 * Helper function to get payroll by ID with proper tenant isolation
 */
async function getPayrollById(id, tenantId) {
  return prisma.payroll.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      employee: true,
    }
  });
}

/**
 * GET - Fetch a single payroll by ID
 */
export async function GET(request, context) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { id: payrollId } = await context.params;

    // Check if payroll exists
    const payroll = await getPayrollById(payrollId, user.tenantId);
    
    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(payroll);
  } catch (error) {
    console.error(`Error fetching payroll ${context?.params?.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch payroll. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a payroll
 */
export async function PUT(request, context) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { id: payrollId } = await context.params;
    const body = await request.json();

    // Check if payroll exists
    const existingPayroll = await getPayrollById(payrollId, user.tenantId);
    
    if (!existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    // Check if payroll belongs to the user's tenant (if multi-tenancy is implemented)
    // This check can be uncommented when tenantId is added to the Payroll model
    /*
    if (existingPayroll.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    */
    
    // Prevent updating processed payrolls unless explicitly allowed
    // Only allow editing of Draft payrolls
    if (existingPayroll.status === 'Processed' && !body.forceUpdate) {
      return NextResponse.json(
        { error: 'Cannot update a processed payroll. Use forceUpdate flag if necessary.' },
        { status: 400 }
      );
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that are provided in the request
    if (body.periodStart !== undefined || body.periodEnd !== undefined) {
      const seed = body.periodStart !== undefined ? body.periodStart : existingPayroll.periodStart;
      const { periodStart, periodEnd } = normalizePayrollMonthPeriod(seed, body.periodEnd ?? seed);
      updateData.periodStart = periodStart;
      updateData.periodEnd = periodEnd;
    }
    if (body.basicSalary !== undefined) updateData.basicSalary = body.basicSalary;
    if (body.deductions !== undefined) updateData.deductions = body.deductions;
    if (body.additions !== undefined) updateData.additions = body.additions;
    if (body.netPay !== undefined) updateData.netPay = body.netPay;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.paymentDate !== undefined) updateData.paymentDate = body.paymentDate ? new Date(body.paymentDate) : null;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    // Update the payroll
    const updatedPayroll = await prisma.payroll.update({
      where: { id: payrollId },
      data: updateData,
      include: {
        employee: true,
      }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYROLL_UPDATED',
        entityType: 'PAYROLL',
        entityId: payrollId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: updatedPayroll.employee.name,
          updatedFields: Object.keys(updateData),
        }),
      },
    });
    
    return NextResponse.json({
      message: 'Payroll updated successfully',
      payroll: updatedPayroll
    });
  } catch (error) {
    console.error(`Error updating payroll ${context?.params?.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update payroll. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a payroll
 */
export async function DELETE(request, context) {
  let payrollId = null;
  let tenantIdForRecovery = null;
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    tenantIdForRecovery = user.tenantId;

    const params = await context.params;
    payrollId = typeof params?.id === 'string' ? params.id : null;
    if (!payrollId) {
      return NextResponse.json({ error: 'Invalid payroll id' }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const reversalReasonRaw =
      typeof body?.reversalReason === 'string' ? body.reversalReason : 'Payroll deleted (auto reversal)';
    const reversalReason = reversalReasonRaw.trim();
    
    // Check if payroll exists and belongs to the user's tenant
    const existingPayroll = await getPayrollById(payrollId, user.tenantId);
    
    if (!existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    // No hard delete: deleting payroll performs a full accounting reversal.
    // If this payroll has no posted journal, we still keep the record and mark it reversed.
    if (existingPayroll.status === 'Reversed') {
      return NextResponse.json({ message: 'Payroll already reversed' });
    }

    const reasonForReversal =
      reversalReason.length >= 10 ? reversalReason : 'Payroll deleted (auto reversal)';

    const glState = await resolvePostedPayrollJournalState(user.tenantId, payrollId);

    let reversal = null;

    if (glState.kind === 'none' || glState.kind === 'empty_journal') {
      const updated = await prisma.payroll.updateMany({
        where: { id: payrollId, tenantId: user.tenantId, status: { not: 'Reversed' } },
        data: { status: 'Reversed' },
      });
      if (updated.count === 0) {
        return NextResponse.json({ message: 'Payroll already reversed' });
      }
    } else if (glState.kind === 'multiple') {
      return NextResponse.json(
        {
          error:
            'Multiple payroll journals found for this payroll; resolve duplicates before deleting.',
        },
        { status: 409 }
      );
    } else {
      try {
        reversal = await reversePayroll({
          payrollId,
          reversalReason: reasonForReversal,
          userId: user.id,
          tenantId: user.tenantId,
        });
      } catch (e) {
        const msg = String(e?.message || e || '').toLowerCase();
        const noJournalMsg =
          msg.includes('no posted journal') ||
          msg.includes('no posted journal transaction') ||
          msg.includes('cannot be performed without gl entries') ||
          msg.includes('has no journal entries to reverse') ||
          msg.includes('payroll journal transaction has no lines') ||
          msg.includes('reversal cannot be performed without gl');

        const again = await resolvePostedPayrollJournalState(user.tenantId, payrollId);
        const allowSoftCancel =
          again.kind === 'none' ||
          again.kind === 'empty_journal' ||
          (noJournalMsg && again.kind !== 'multiple');

        if (!allowSoftCancel) throw e;

        const updated = await prisma.payroll.updateMany({
          where: { id: payrollId, tenantId: user.tenantId, status: { not: 'Reversed' } },
          data: { status: 'Reversed' },
        });
        if (updated.count === 0) {
          return NextResponse.json({ message: 'Payroll already reversed' });
        }
      }
    }
    
    // Create audit log (non-fatal — reversal already completed)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'PAYROLL_REVERSED',
          entityType: 'PAYROLL',
          entityId: payrollId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            employeeName: existingPayroll.employee?.name ?? null,
            periodStart: existingPayroll.periodStart,
            periodEnd: existingPayroll.periodEnd,
            reversalReason: reversalReason,
            reversalTransactionId: reversal?.reversal?.id || null,
          }),
        },
      });
    } catch (auditErr) {
      console.error('Payroll delete audit log failed (non-fatal):', auditErr?.message || auditErr);
    }

    return NextResponse.json({
      message: 'Payroll reversed successfully',
      reversal: reversal || null
    });
  } catch (error) {
    const errMsg = String(error?.message || error || '');
    console.error('Error deleting payroll:', error);

    if (/closed accounting period/i.test(errMsg)) {
      return NextResponse.json({ error: errMsg }, { status: 423 });
    }
    if (
      /multiple payroll journals/i.test(errMsg) ||
      /already been reversed/i.test(errMsg) ||
      /transaction has already been reversed/i.test(errMsg)
    ) {
      return NextResponse.json({ error: errMsg }, { status: 409 });
    }

    // Last resort: if there is still no posted payroll GL for this id, never return 500 — mark reversed.
    if (tenantIdForRecovery && payrollId) {
      try {
        const st = await resolvePostedPayrollJournalState(tenantIdForRecovery, payrollId);
        if (st.kind === 'none' || st.kind === 'empty_journal') {
          const updated = await prisma.payroll.updateMany({
            where: {
              id: payrollId,
              tenantId: tenantIdForRecovery,
              status: { not: 'Reversed' },
            },
            data: { status: 'Reversed' },
          });
          if (updated.count > 0) {
            return NextResponse.json({
              message: 'Payroll cancelled (no posted GL journal for this entry).',
              reversal: null,
            });
          }
          return NextResponse.json({ message: 'Payroll already reversed' });
        }
      } catch (recoveryErr) {
        console.error('Payroll delete recovery failed:', recoveryErr?.message || recoveryErr);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to delete payroll. Please try again.',
        ...(process.env.NODE_ENV !== 'production' && { detail: errMsg }),
      },
      { status: 500 }
    );
  }
}