// app/api/employees/[id]/benefits/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeDeductionIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function loadNpsOptions(tenantId) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
      FROM "TenantSettings"
      WHERE "tenantId" = ${tenantId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    return row ? npsRatesFromTenantSettingsRow(row) : {
      npsEmployeeRatePercent: null,
      npsEmployerRatePercent: null,
    };
  } catch (e) {
    console.warn('Employee benefits NPS rate read failed:', e?.message || e);
    return {
      npsEmployeeRatePercent: null,
      npsEmployerRatePercent: null,
    };
  }
}

/**
 * GET - List benefits assigned to this employee (with amounts)
 */
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId }
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employeeBenefits = await prisma.employeeBenefit.findMany({
      where: { employeeId },
      include: {
        benefit: {
          select: {
            id: true,
            name: true,
            description: true,
            defaultAmount: true,
            defaultPercentage: true,
            isActive: true
          }
        }
      }
    });

    const benefits = employeeBenefits.map(eb => ({
      id: eb.id,
      benefitId: eb.benefitId,
      amount: eb.amount,
      benefitName: eb.benefit.name,
      description: eb.benefit.description,
      isActive: eb.benefit.isActive
    }));

    return NextResponse.json({ benefits });
  } catch (error) {
    console.error('Error fetching employee benefits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee benefits' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Set benefits for this employee. Body: { benefits: [ { benefitId, amount } ] }
 * Replaces all existing assignments.
 */
export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: employeeId } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId: user.tenantId }
    });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const body = await request.json();
    const items = Array.isArray(body.benefits) ? body.benefits : [];

    // Validate benefit IDs belong to tenant
    const benefitIds = [...new Set(items.map(b => b.benefitId).filter(Boolean))];
    if (benefitIds.length > 0) {
      const benefits = await prisma.benefit.findMany({
        where: { id: { in: benefitIds }, tenantId: user.tenantId, isActive: true }
      });
      const validIds = new Set(benefits.map(b => b.id));
      const invalid = benefitIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: 'Some benefit IDs are invalid or inactive' },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeBenefit.deleteMany({ where: { employeeId } });

      for (const item of items) {
        if (!item.benefitId || (item.amount != null && Number(item.amount) < 0)) continue;
        const amount = item.amount != null ? Number(item.amount) : 0;
        if (amount === 0) continue;

        await tx.employeeBenefit.create({
          data: {
            employeeId,
            benefitId: item.benefitId,
            amount
          }
        });
      }
    });

    const updated = await prisma.employeeBenefit.findMany({
      where: { employeeId },
      include: {
        benefit: {
          select: {
            id: true,
            name: true,
            defaultAmount: true,
            isActive: true
          }
        }
      }
    });

    const grossSalary = Number(employee.grossSalary);
    if (Number.isFinite(grossSalary) && grossSalary > 0) {
      const benefitTotal = updated.reduce((sum, eb) => sum + (Number(eb.amount) || 0), 0);
      const deductionIds = normalizeDeductionIds(employee.selectedDeductions);
      const deductions = deductionIds.length > 0
        ? await prisma.deduction.findMany({
            where: {
              id: { in: deductionIds },
              tenantId: user.tenantId,
              isActive: true,
            },
          })
        : [];
      const npsOptions = await loadNpsOptions(user.tenantId);
      const calc = calculatePayroll(grossSalary, deductions, npsOptions);
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          salary: roundMoney(calc.netPay + benefitTotal),
          grossSalary: calc.grossSalary,
        },
      });
    }

    return NextResponse.json({
      benefits: updated.map(eb => ({
        id: eb.id,
        benefitId: eb.benefitId,
        amount: eb.amount,
        benefitName: eb.benefit.name
      }))
    });
  } catch (error) {
    console.error('Error updating employee benefits:', error);
    return NextResponse.json(
      { error: 'Failed to update employee benefits' },
      { status: 500 }
    );
  }
}
