// app/api/employees/[id]/reactivate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST - Reactivate a terminated or suspended employee
 */
export async function POST(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        tenantId: true,
        status: true
      }
    });

    if (!employee || employee.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Reactivate employee
    const updated = await prisma.employee.update({
      where: { id },
      data: {
        status: 'Active',
        isActive: true,
        suspendedFrom: null,
        suspendedTo: null,
        suspensionReason: null
        // Note: We keep terminationDate and terminationReason for historical records
      },
      include: {
        departmentRef: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'EMPLOYEE_REACTIVATED',
        entityType: 'EMPLOYEE',
        entityId: id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          employeeName: employee.name,
          previousStatus: employee.status
        })
      }
    });

    return NextResponse.json({ 
      success: true,
      employee: updated 
    });

  } catch (error) {
    console.error('Error reactivating employee:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate employee', details: error.message },
      { status: 500 }
    );
  }
}

