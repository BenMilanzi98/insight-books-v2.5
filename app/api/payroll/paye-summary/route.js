// app/api/payroll/paye-summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const status = searchParams.get('status'); // optional: Pending | Paid (UI currently doesn't pass it)

    // Build inclusive date filter (YYYY-MM-DD from UI)
    const dateFilter = {};
    if (fromDate) {
      const d = new Date(fromDate);
      d.setHours(0, 0, 0, 0);
      dateFilter.gte = d;
    }
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      dateFilter.lte = d;
    }

    // Payroll deductions are the source-of-truth for PAYE withheld.
    // Use Payroll table instead of relying on Expense rows (which may not exist in some flows).
    const payrollWhere = {
      tenantId: user.tenantId,
      payeAmount: { gt: 0 },
    };
    // Filter by paymentDate if available; otherwise fall back to periodEnd.
    // We implement this as OR so payrolls without paymentDate are still included.
    if (Object.keys(dateFilter).length > 0) {
      payrollWhere.OR = [
        { paymentDate: dateFilter },
        { paymentDate: null, periodEnd: dateFilter },
      ];
    }
    if (status === 'Paid') {
      // PAYE "paid" here means payroll was processed (i.e., deduction occurred) and not reversed.
      // Remittance to MRA is tracked separately via expense payments and is not per-employee.
      payrollWhere.status = { not: 'Reversed' };
    } else if (status === 'Pending') {
      // Pending here means deduction exists and payroll not reversed.
      payrollWhere.status = { not: 'Reversed' };
    }

    const payrolls = await prisma.payroll.findMany({
      where: payrollWhere,
      orderBy: { periodEnd: 'desc' },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        paymentDate: true,
        payeAmount: true,
        status: true,
        employee: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            department: true,
          }
        }
      }
    });

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // Totals: treat reversed payrolls as negative deductions (for audit correctness).
    const totals = payrolls.reduce(
      (acc, p) => {
        const amt = num(p.payeAmount);
        const signed = p.status === 'Reversed' ? -amt : amt;
        acc.total += signed;
        if (p.status === 'Reversed') acc.reversed += amt;
        else acc.deducted += amt;
        return acc;
      },
      { total: 0, deducted: 0, reversed: 0 }
    );

    // Group by employee for detailed breakdown
    const employeeBreakdown = {};
    
    for (const p of payrolls) {
      const amt = num(p.payeAmount);
      const signed = p.status === 'Reversed' ? -amt : amt;
      const empId = p.employeeId || p.employee?.id || 'unknown';
      const empName = p.employee?.name || 'Unknown';
      
      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = {
          employeeId: empId,
          employeeName: empName,
          employeeNumber: p.employee?.employeeId || 'N/A',
          department: p.employee?.department || 'N/A',
          totalPaye: 0,
          pendingAmount: 0, // PAYE withheld (not reversed)
          paidAmount: 0,    // Remittance is not tracked per employee; keep 0 for now
          periods: []
        };
      }

      employeeBreakdown[empId].totalPaye += signed;
      if (p.status !== 'Reversed') {
        employeeBreakdown[empId].pendingAmount += amt;
      }

      const periodLabel = `${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`;
      employeeBreakdown[empId].periods.push({
        date: p.paymentDate || p.periodEnd,
        amount: signed,
        status: p.status === 'Reversed' ? 'Reversed' : 'Pending',
        period: periodLabel
      });
    }

    // Convert to array and sort by total PAYE descending
    const breakdownArray = Object.values(employeeBreakdown)
      .sort((a, b) => b.totalPaye - a.totalPaye);

    return NextResponse.json({
      summary: {
        totalPaye: totals.total,
        pendingPaye: totals.deducted,
        paidPaye: 0,
        reversedPaye: totals.reversed,
        payrollCount: payrolls.length,
        employeeCount: breakdownArray.length
      },
      byEmployee: breakdownArray,
      details: payrolls.map(p => {
        const amt = num(p.payeAmount);
        const signed = p.status === 'Reversed' ? -amt : amt;
        return {
          id: p.id,
          date: p.paymentDate || p.periodEnd,
          employeeName: p.employee?.name || 'Unknown',
          employeeNumber: p.employee?.employeeId || 'N/A',
          department: p.employee?.department || 'N/A',
          amount: signed,
          status: p.status === 'Reversed' ? 'Reversed' : 'Pending',
          periodStart: p.periodStart,
          periodEnd: p.periodEnd
        };
      })
    });
  } catch (error) {
    console.error('Error getting PAYE summary:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch PAYE summary', details: error.message },
      { status: 500 }
    );
  }
}
