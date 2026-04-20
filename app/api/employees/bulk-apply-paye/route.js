// POST /api/employees/bulk-apply-paye
// Enable or remove the tenant's PAYE deduction on many employees' selectedDeductions,
// and recalculate net salary from grossSalary when gross is set.
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { calculatePayroll } from '@/lib/payrollCalculations';
import { npsRatesFromTenantSettingsRow } from '@/lib/npsTenantRates';

function normalizeDeductionIds(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function findPayeDeductionId(tenantId) {
  const rows = await prisma.deduction.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, isStatutory: true },
  });
  const paye = rows.find((d) => {
    const n = (d.name || '').toLowerCase();
    return (
      n.includes('paye') ||
      n.includes('pay as you earn') ||
      (d.isStatutory && n.includes('income tax')) ||
      (d.isStatutory && n === 'tax')
    );
  });
  return paye?.id || null;
}

async function loadNpsOptions(tenantId) {
  let npsOptions = { npsEmployeeRatePercent: null, npsEmployerRatePercent: null };
  try {
    const rows = await prisma.$queryRaw`
      SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
      FROM "TenantSettings"
      WHERE "tenantId" = ${tenantId}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row) npsOptions = npsRatesFromTenantSettingsRow(row);
  } catch (e) {
    console.warn('[bulk-apply-paye] NPS rate read failed:', e?.message || e);
  }
  return npsOptions;
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const perm = await requirePermission(request, 'employees.update');
    if (perm) return perm;

    const body = await request.json().catch(() => ({}));
    const action = body.action === 'disable' ? 'disable' : 'enable';
    const scope = body.scope === 'all' ? 'all' : 'selected';
    const requestedIds = Array.isArray(body.employeeIds)
      ? body.employeeIds.filter((id) => typeof id === 'string' && id.trim())
      : [];

    if (scope === 'selected' && requestedIds.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one employee, or choose “All employees”.' },
        { status: 400 }
      );
    }

    const payeDeductionId = await findPayeDeductionId(user.tenantId);
    if (!payeDeductionId) {
      return NextResponse.json(
        {
          error:
            'No active PAYE deduction found. Create a statutory deduction named PAYE (or Income Tax) under HR → Deductions first.',
        },
        { status: 400 }
      );
    }

    let targetIds;
    if (scope === 'all') {
      const all = await prisma.employee.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true },
      });
      targetIds = all.map((e) => e.id);
    } else {
      const found = await prisma.employee.findMany({
        where: { id: { in: requestedIds }, tenantId: user.tenantId },
        select: { id: true },
      });
      targetIds = found.map((e) => e.id);
      const missing = requestedIds.filter((id) => !targetIds.includes(id));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'Some employees were not found or do not belong to your business.', missing },
          { status: 404 }
        );
      }
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'No employees to update.' }, { status: 400 });
    }

    const npsOptions = await loadNpsOptions(user.tenantId);
    let updated = 0;
    let skipped = 0;

    for (const employeeId of targetIds) {
      const emp = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId: user.tenantId },
        select: {
          id: true,
          grossSalary: true,
          salary: true,
          selectedDeductions: true,
        },
      });
      if (!emp) {
        skipped += 1;
        continue;
      }

      let ids = normalizeDeductionIds(emp.selectedDeductions);
      const hadPaye = ids.includes(payeDeductionId);

      if (action === 'enable') {
        if (!hadPaye) ids = [...ids, payeDeductionId];
      } else {
        ids = ids.filter((id) => id !== payeDeductionId);
      }

      const prevSorted = normalizeDeductionIds(emp.selectedDeductions).slice().sort().join('|');
      const nextSorted = ids.slice().sort().join('|');
      if (prevSorted === nextSorted) {
        skipped += 1;
        continue;
      }

      const nextJson = ids.length > 0 ? ids : null;

      const gross = parseFloat(emp.grossSalary);
      const hasGross = Number.isFinite(gross) && gross > 0;

      let salaryUpdate = {};
      if (hasGross) {
        const deductions = await prisma.deduction.findMany({
          where: {
            id: { in: ids },
            tenantId: user.tenantId,
            isActive: true,
          },
        });
        const calc = calculatePayroll(gross, deductions, npsOptions);
        salaryUpdate = {
          salary: calc.netPay,
          grossSalary: calc.grossSalary,
        };
      }

      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          selectedDeductions: nextJson,
          ...salaryUpdate,
        },
      });
      updated += 1;
    }

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      totalTargets: targetIds.length,
      payeDeductionId,
      action,
      scope,
    });
  } catch (error) {
    console.error('[bulk-apply-paye]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update employees' },
      { status: 500 }
    );
  }
}
