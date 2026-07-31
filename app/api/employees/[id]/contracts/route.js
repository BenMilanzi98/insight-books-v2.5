import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import {
  CONTRACT_STATUSES,
  assertNoActiveContractOverlap,
  resolvePayBasis,
} from '@/lib/employmentContract';
import { parseMoney } from '@/lib/money';

async function loadEmployee(tenantId, employeeId) {
  return prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, tenantId: true, salary: true, grossSalary: true, hourlyRate: true },
  });
}

export async function GET(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, ['hr.view', 'payroll.view']);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: employeeId } = await params;
    const employee = await loadEmployee(user.tenantId, employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const contracts = await prisma.employmentContract.findMany({
      where: { tenantId: user.tenantId, employeeId },
      orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    });

    return NextResponse.json({ contracts });
  } catch (error) {
    console.error('Error listing employment contracts:', error);
    return NextResponse.json({ error: 'Failed to list contracts' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const perm = await requireAnyPermission(request, [
      'hr.update',
      'hr.create',
      'payroll.update',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: employeeId } = await params;
    const employee = await loadEmployee(user.tenantId, employeeId);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) {
      return NextResponse.json({ error: 'Invalid effectiveFrom' }, { status: 400 });
    }
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      return NextResponse.json({ error: 'Invalid effectiveTo' }, { status: 400 });
    }

    const status = body.status || CONTRACT_STATUSES.DRAFT;
    const payBasis = resolvePayBasis({
      payBasis: body.payBasis,
      hourlyRate: body.hourlyRate ?? employee.hourlyRate,
      dailyRate: body.dailyRate,
      basicSalary: body.basicSalary ?? employee.grossSalary ?? employee.salary,
    });

    const basicSalary = parseMoney(
      body.basicSalary ?? employee.grossSalary ?? employee.salary ?? 0
    );
    const hourlyRate =
      body.hourlyRate != null || employee.hourlyRate != null
        ? parseMoney(body.hourlyRate ?? employee.hourlyRate)
        : null;
    const dailyRate = body.dailyRate != null ? parseMoney(body.dailyRate) : null;

    const existing = await prisma.employmentContract.findMany({
      where: { tenantId: user.tenantId, employeeId },
      select: {
        id: true,
        status: true,
        effectiveFrom: true,
        effectiveTo: true,
        version: true,
      },
    });

    try {
      assertNoActiveContractOverlap(existing, {
        status,
        effectiveFrom,
        effectiveTo,
      });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }

    const nextVersion =
      existing.reduce((max, c) => Math.max(max, c.version || 0), 0) + 1;

    const activate = status === CONTRACT_STATUSES.ACTIVE || body.activate === true;
    const finalStatus = activate ? CONTRACT_STATUSES.ACTIVE : status;

    if (activate) {
      try {
        assertNoActiveContractOverlap(existing, {
          status: CONTRACT_STATUSES.ACTIVE,
          effectiveFrom,
          effectiveTo,
        });
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
    }

    const contract = await prisma.$transaction(async (tx) => {
      if (activate) {
        // Supersede prior ACTIVE contracts ending just before new effectiveFrom
        const priorActive = await tx.employmentContract.findMany({
          where: {
            tenantId: user.tenantId,
            employeeId,
            status: CONTRACT_STATUSES.ACTIVE,
          },
        });
        for (const row of priorActive) {
          const end = new Date(effectiveFrom);
          end.setDate(end.getDate() - 1);
          await tx.employmentContract.update({
            where: { id: row.id },
            data: {
              status: CONTRACT_STATUSES.SUPERSEDED,
              effectiveTo: row.effectiveTo && row.effectiveTo < end ? row.effectiveTo : end,
            },
          });
        }
      }

      return tx.employmentContract.create({
        data: {
          tenantId: user.tenantId,
          employeeId,
          version: nextVersion,
          status: finalStatus,
          payBasis,
          payFrequency: body.payFrequency || 'MONTHLY',
          basicSalary,
          hourlyRate,
          dailyRate,
          standardWeeklyHours:
            body.standardWeeklyHours != null ? parseMoney(body.standardWeeklyHours) : null,
          standardMonthlyHours:
            body.standardMonthlyHours != null ? parseMoney(body.standardMonthlyHours) : null,
          overtimeEligible: body.overtimeEligible !== false,
          overtimeMultiplier:
            body.overtimeMultiplier != null ? parseMoney(body.overtimeMultiplier) : 1.5,
          currency: body.currency || 'MWK',
          position: body.position || null,
          departmentId: body.departmentId || null,
          branchId: body.branchId || null,
          employmentType: body.employmentType || null,
          pensionEligible: body.pensionEligible !== false,
          gratuityEligible: body.gratuityEligible !== false,
          effectiveFrom,
          effectiveTo,
          notes: body.notes || null,
          approvedAt: activate ? new Date() : null,
          approvedById: activate ? user.id : null,
        },
      });
    });

    return NextResponse.json({ contract }, { status: 201 });
  } catch (error) {
    console.error('Error creating employment contract:', error);
    return NextResponse.json(
      {
        error: 'Failed to create contract',
        ...(process.env.NODE_ENV === 'development'
          ? { detail: error?.message || String(error) }
          : {}),
      },
      { status: 500 }
    );
  }
}
