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

    // Build expense filter
    const expenseWhere = {
      tenantId: user.tenantId,
      category: 'Tax',
      description: { contains: 'PAYE', mode: 'insensitive' },
      isDeleted: false,
      status: 'Approved',
    };

    if (Object.keys(dateFilter).length > 0) {
      expenseWhere.date = dateFilter;
    }

    // Optional high-level filter: "Paid" means fully/partially paid; "Pending" means no payment yet.
    if (status === 'Paid') {
      expenseWhere.OR = [
        { paymentStatus: { in: ['Fully paid', 'Paid', 'Partially', 'Partially paid'] } },
        { paidAmount: { gt: 0 } }
      ];
    } else if (status === 'Pending') {
      expenseWhere.AND = [
        { OR: [{ paymentStatus: 'Pending' }, { paymentStatus: null }] },
        { OR: [{ paidAmount: null }, { paidAmount: { lte: 0 } }] }
      ];
    }

    // Get PAYE expenses grouped by employee
    const payeExpenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        paidAmount: true,
        paymentStatus: true,
        notes: true,
        employeeId: true,
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          }
        }
      }
    });

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

    // For PAYE expenses: `amount` = assessed PAYE; `paidAmount` = remitted amount (may be partial).
    const totals = payeExpenses.reduce(
      (acc, exp) => {
        const assessed = num(exp.amount);
        const paid = clamp(num(exp.paidAmount), 0, assessed);
        acc.total += assessed;
        acc.paid += paid;
        acc.pending += Math.max(0, assessed - paid);
        return acc;
      },
      { total: 0, paid: 0, pending: 0 }
    );

    // Group by employee for detailed breakdown
    const employeeBreakdown = {};
    
    for (const expense of payeExpenses) {
      const assessed = num(expense.amount);
      const paid = clamp(num(expense.paidAmount), 0, assessed);
      const pending = Math.max(0, assessed - paid);

      const empId = expense.employeeId || expense.employee?.id || 'unknown';
      const empName = expense.employee?.name || (() => {
        const nameMatch = expense.description?.match(/PAYE Tax\s*-\s*(.+)/i);
        return nameMatch ? nameMatch[1] : 'Unknown';
      })();
      
      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = {
          employeeId: empId,
          employeeName: empName,
          employeeNumber: expense.employee?.employeeNumber || 'N/A',
          department: expense.employee?.department || 'N/A',
          totalPaye: 0,
          pendingAmount: 0,
          paidAmount: 0,
          periods: []
        };
      }

      employeeBreakdown[empId].totalPaye += assessed;
      employeeBreakdown[empId].paidAmount += paid;
      employeeBreakdown[empId].pendingAmount += pending;

      // Extract period from notes or description
      const periodMatch = expense.notes?.match(/Period: ([^|]+)/);
      employeeBreakdown[empId].periods.push({
        date: expense.date,
        amount: assessed,
        status: pending > 0 ? (paid > 0 ? 'Partially' : 'Pending') : 'Paid',
        period: periodMatch ? periodMatch[1].trim() : expense.date.toLocaleDateString()
      });
    }

    // Convert to array and sort by total PAYE descending
    const breakdownArray = Object.values(employeeBreakdown)
      .sort((a, b) => b.totalPaye - a.totalPaye);

    return NextResponse.json({
      summary: {
        totalPaye: totals.total,
        pendingPaye: totals.pending,
        paidPaye: totals.paid,
        expenseCount: payeExpenses.length,
        employeeCount: breakdownArray.length
      },
      byEmployee: breakdownArray,
      details: payeExpenses.map(exp => {
        const assessed = num(exp.amount);
        const paid = clamp(num(exp.paidAmount), 0, assessed);
        const pending = Math.max(0, assessed - paid);
        const nameMatch = exp.description?.match(/PAYE Tax\s*-\s*(.+)/i);
        return {
          id: exp.id,
          date: exp.date,
          employeeName: exp.employee?.name || (nameMatch ? nameMatch[1] : 'Unknown'),
          employeeNumber: exp.employee?.employeeNumber || 'N/A',
          department: exp.employee?.department || 'N/A',
          amount: assessed,
          paidAmount: paid,
          pendingAmount: pending,
          status: pending > 0 ? (paid > 0 ? 'Partially' : 'Pending') : 'Paid',
          notes: exp.notes
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
