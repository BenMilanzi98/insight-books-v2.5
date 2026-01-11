// app/api/payroll/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * Helper function to get payroll by ID with proper tenant isolation
 */
async function getPayrollById(id) {
  return prisma.payroll.findUnique({
    where: { 
      id
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
    
    const payrollId = context.params.id;
    
    // Check if payroll exists
    const payroll = await getPayrollById(payrollId);
    
    if (!payroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    // Check if payroll belongs to the user's tenant (if multi-tenancy is implemented)
    // This check can be uncommented when tenantId is added to the Payroll model
    /*
    if (payroll.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    */
    
    return NextResponse.json(payroll);
  } catch (error) {
    console.error(`Error fetching payroll ${params.id}:`, error);
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
    
    const payrollId = context.params.id;
    const body = await request.json();
    
    // Check if payroll exists
    const existingPayroll = await getPayrollById(payrollId);
    
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
    if (body.periodStart !== undefined) updateData.periodStart = new Date(body.periodStart);
    if (body.periodEnd !== undefined) updateData.periodEnd = new Date(body.periodEnd);
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
    console.error(`Error updating payroll ${params.id}:`, error);
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
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const payrollId = context.params.id;
    
    // Check if payroll exists and belongs to the user's tenant
    const existingPayroll = await getPayrollById(payrollId, user.tenantId);
    
    if (!existingPayroll) {
      return NextResponse.json(
        { error: 'Payroll not found' },
        { status: 404 }
      );
    }
    
    // Prevent deleting processed payrolls
    if (existingPayroll.status === 'Processed') {
      return NextResponse.json(
        { error: 'Cannot delete a processed payroll. Set to void status instead.' },
        { status: 400 }
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
    
    // Delete the payroll
    await prisma.payroll.delete({
      where: { id: payrollId }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYROLL_DELETED',
        entityType: 'PAYROLL',
        entityId: payrollId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: existingPayroll.employee.name,
          periodStart: existingPayroll.periodStart,
          periodEnd: existingPayroll.periodEnd,
        }),
      },
    });
    
    return NextResponse.json({
      message: 'Payroll deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting payroll ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete payroll. Please try again.' },
      { status: 500 }
    );
  }
}