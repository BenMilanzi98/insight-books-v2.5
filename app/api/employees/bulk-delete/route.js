// app/api/employees/bulk-delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

/**
 * POST /api/employees/bulk-delete
 * Permanently delete multiple employees (hard delete).
 * Body: { ids: string[] }
 * Single-employee delete via DELETE /api/employees/[id] remains soft (inactive).
 */
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const perm = await requirePermission(request, 'employees.delete');
    if (perm) return perm;

    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && id.trim()) : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No employee IDs provided' },
        { status: 400 }
      );
    }

    // Restrict to this tenant only
    const employees = await prisma.employee.findMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
      },
      select: { id: true, name: true },
    });

    const foundIds = employees.map((e) => e.id);
    const notFound = ids.filter((id) => !foundIds.includes(id));
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: 'Some employees not found or access denied', notFound },
        { status: 404 }
      );
    }

    // 1) Payroll has no onDelete cascade – delete first
    await prisma.payroll.deleteMany({
      where: {
        employeeId: { in: foundIds },
        tenantId: user.tenantId,
      },
    });

    // 2) Expense has optional employeeId – clear reference so we can delete employees
    await prisma.expense.updateMany({
      where: {
        employeeId: { in: foundIds },
        tenantId: user.tenantId,
      },
      data: { employeeId: null },
    });

    // 3) Hard delete employees (cascades: EmployeeBenefit, GratuityAccount, SalaryAdvance,
    //    AttendanceRecord, LeaveBalance, LeaveRequest, PerformanceGoal, PerformanceReview, etc.)
    await prisma.employee.deleteMany({
      where: {
        id: { in: foundIds },
        tenantId: user.tenantId,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'EMPLOYEES_BULK_DELETED',
          entityType: 'EMPLOYEE',
          entityId: foundIds.join(','),
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            count: foundIds.length,
            names: employees.map((e) => e.name),
          }),
        },
      });
    } catch (e) {
      console.warn('Audit log failed for bulk delete:', e?.message || e);
    }

    return NextResponse.json({
      message: `${foundIds.length} employee(s) permanently deleted`,
      deletedCount: foundIds.length,
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    return NextResponse.json(
      { error: 'Failed to delete employees', details: error.message },
      { status: 500 }
    );
  }
}
