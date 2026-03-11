// app/api/pension/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

function safeNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseNotesJSON(notes) {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return {};
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getRatePercentFromNotesOrFallback(info, fallbackEmployee = 5, fallbackEmployer = 5) {
  const emp = safeNumber(info?.npsEmployeeRatePercent);
  const er = safeNumber(info?.npsEmployerRatePercent);
  return {
    employeeRatePercent: emp > 0 ? emp : fallbackEmployee,
    employerRatePercent: er > 0 ? er : fallbackEmployer
  };
}

/**
 * GET /api/pension
 * Query params:
 * - startDate (optional, ISO or yyyy-mm-dd)
 * - endDate (optional, ISO or yyyy-mm-dd)
 * - employeeId (optional)
 *
 * Returns:
 * - summary totals (employee/employer/total)
 * - byEmployee aggregation
 * - entries (only if employeeId provided)
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');

    const startDate = startDateParam ? new Date(startDateParam) : null;
    const endDate = endDateParam ? new Date(endDateParam) : null;

    if (startDateParam && Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    }
    if (endDateParam && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
    }

    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'endDate cannot be before startDate' }, { status: 400 });
    }

    // Normalize to full-day range if dates are provided
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const where = {
      tenantId: user.tenantId,
      ...(employeeId ? { employeeId } : {}),
      ...(startDate || endDate
        ? {
            AND: [
              ...(startDate ? [{ periodEnd: { gte: startDate } }] : []),
              ...(endDate ? [{ periodStart: { lte: endDate } }] : []),
            ],
          }
        : {}),
    };

    // Current tenant rates used as fallback for legacy payroll rows that only have totalNpsAmount.
    // Use raw SQL so this endpoint still works even if Prisma Client is stale.
    let fallbackEmployeeRate = 5;
    let fallbackEmployerRate = 5;
    try {
      const rows = await prisma.$queryRaw`
        SELECT "npsEmployeeRatePercent", "npsEmployerRatePercent"
        FROM "TenantSettings"
        WHERE "tenantId" = ${user.tenantId}
        LIMIT 1
      `;
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row && typeof row === 'object') {
        fallbackEmployeeRate = Number(row.npsEmployeeRatePercent ?? row.npsemployeeratepercent ?? 5) || 5;
        fallbackEmployerRate = Number(row.npsEmployerRatePercent ?? row.npsemployerratepercent ?? 5) || 5;
      }
    } catch (e) {
      console.warn('Pension report raw rate read failed, falling back to defaults:', e?.message || e);
    }

    // We only care about payrolls that actually have NPS applied
    // totalNpsAmount is stored on Payroll, and employee/employer split is in notes.additionalInfo
    const payrolls = await prisma.payroll.findMany({
      where: {
        ...where,
        OR: [
          { totalNpsAmount: { gt: 0 } },
          // In case older records only had notes populated (rare) but total is 0
          { notes: { contains: 'npsEmployeeAmount' } },
          { notes: { contains: 'npsEmployerAmount' } },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
          },
        },
      },
      orderBy: [{ periodEnd: 'desc' }],
    });

    // Build entries with computed split amounts.
    // IMPORTANT: We compute contributions from grossPay * (rates) so the report stays accurate
    // even if older payroll rows were posted with default 5%/5% due to stale Prisma client config.
    const entries = payrolls.map((p) => {
      const info = parseNotesJSON(p.notes);
      const storedTotal = safeNumber(p.totalNpsAmount);
      const grossForNps = safeNumber(p.grossPay);

      // Prefer rates stored on the payroll run (if present), else fall back to tenant rates
      const rates = getRatePercentFromNotesOrFallback(info, fallbackEmployeeRate, fallbackEmployerRate);
      const employeeRatePercent = safeNumber(rates.employeeRatePercent);
      const employerRatePercent = safeNumber(rates.employerRatePercent);

      // Preferred computation: compute NPS from grossPay * configured rates.
      const computedEmployee = grossForNps > 0 ? round2((grossForNps * employeeRatePercent) / 100) : 0;
      const computedEmployer = grossForNps > 0 ? round2((grossForNps * employerRatePercent) / 100) : 0;

      // Legacy fallback: use stored split if present, else split storedTotal proportionally.
      const hasSplit =
        info.npsEmployeeAmount !== undefined || info.npsEmployerAmount !== undefined;
      let employeeAmount = hasSplit ? safeNumber(info.npsEmployeeAmount) : 0;
      let employerAmount = hasSplit ? safeNumber(info.npsEmployerAmount) : 0;

      if (!hasSplit && storedTotal > 0) {
        const denom = employeeRatePercent + employerRatePercent;
        if (denom > 0) {
          employeeAmount = (storedTotal * employeeRatePercent) / denom;
          employerAmount = storedTotal - employeeAmount;
        } else {
          employeeAmount = storedTotal / 2;
          employerAmount = storedTotal / 2;
        }
      }

      // If we can compute from grossPay, prefer that over stored split/total.
      if (grossForNps > 0) {
        employeeAmount = computedEmployee;
        employerAmount = computedEmployer;
      }

      // If employer pension has been cleared/paid for this payroll, exclude it from "outstanding" reporting.
      const employerCleared = !!info?.pensionClearedEmployer;
      if (employerCleared) {
        employerAmount = 0;
      }

      return {
        payrollId: p.id,
        employeeId: p.employeeId,
        employee: p.employee,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paymentDate: p.paymentDate,
        npsEmployeeAmount: employeeAmount,
        npsEmployerAmount: employerAmount,
        totalNpsAmount: round2(employeeAmount + employerAmount) || storedTotal,
        npsEmployeeRatePercent: employeeRatePercent || fallbackEmployeeRate,
        npsEmployerRatePercent: employerRatePercent || fallbackEmployerRate,
        pensionClearedEmployer: employerCleared,
        status: p.status,
      };
    });

    // Aggregate by employee
    const byEmployeeMap = new Map();
    for (const e of entries) {
      const key = e.employeeId;
      const current = byEmployeeMap.get(key) || {
        employeeId: e.employeeId,
        name: e.employee?.name || 'Unknown',
        employeeNumber: e.employee?.employeeId || 'N/A',
        department: e.employee?.department || 'N/A',
        npsEmployeeTotal: 0,
        npsEmployerTotal: 0,
        npsTotal: 0,
        lastPeriodEnd: null,
        lastPaymentDate: null,
      };

      current.npsEmployeeTotal += safeNumber(e.npsEmployeeAmount);
      current.npsEmployerTotal += safeNumber(e.npsEmployerAmount);
      current.npsTotal += safeNumber(e.totalNpsAmount);

      if (!current.lastPeriodEnd || new Date(e.periodEnd) > new Date(current.lastPeriodEnd)) {
        current.lastPeriodEnd = e.periodEnd;
        current.lastPaymentDate = e.paymentDate || null;
      }

      byEmployeeMap.set(key, current);
    }

    const byEmployee = Array.from(byEmployeeMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const totals = byEmployee.reduce(
      (acc, row) => {
        acc.totalEmployees = acc.totalEmployees + 1;
        acc.npsEmployeeTotal += safeNumber(row.npsEmployeeTotal);
        acc.npsEmployerTotal += safeNumber(row.npsEmployerTotal);
        acc.npsTotal += safeNumber(row.npsTotal);
        return acc;
      },
      { totalEmployees: 0, npsEmployeeTotal: 0, npsEmployerTotal: 0, npsTotal: 0 }
    );

    return NextResponse.json({
      period: {
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
      },
      summary: {
        totalEmployees: totals.totalEmployees,
        npsEmployeeTotal: totals.npsEmployeeTotal,
        npsEmployerTotal: totals.npsEmployerTotal,
        npsTotal: totals.npsTotal,
      },
      byEmployee,
      // Only return detailed entries when requesting a specific employee
      entries: employeeId ? entries : undefined,
    });
  } catch (error) {
    console.error('Error generating pension report:', error);
    return NextResponse.json(
      { error: 'Failed to generate pension report', details: error.message },
      { status: 500 }
    );
  }
}


