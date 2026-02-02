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
    const status = searchParams.get('status'); // 'Pending' or 'Paid'

    // Build date filter
    const dateFilter = {};
    if (fromDate) {
      dateFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      dateFilter.lte = new Date(toDate);
    }

    // Build expense filter
    const expenseWhere = {
      tenantId: user.tenantId,
      category: 'Tax',
      description: { contains: 'PAYE', mode: 'insensitive' },
      isDeleted: false
    };

    if (Object.keys(dateFilter).length > 0) {
      expenseWhere.date = dateFilter;
    }

    if (status) {
      expenseWhere.paymentStatus = status;
    }

    // Get PAYE expenses grouped by employee
    const payeExpenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { date: 'desc' }
    });

    // Calculate totals
    const totalPaye = payeExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const pendingPaye = payeExpenses
      .filter(exp => exp.paymentStatus === 'Pending')
      .reduce((sum, exp) => sum + exp.amount, 0);
    const paidPaye = payeExpenses
      .filter(exp => exp.paymentStatus === 'Fully paid' || exp.paymentStatus === 'Paid')
      .reduce((sum, exp) => sum + exp.amount, 0);

    // Group by employee for detailed breakdown
    const employeeBreakdown = {};
    
    // Extract employee info from description (format: "PAYE Tax - Employee Name")
    for (const expense of payeExpenses) {
      const nameMatch = expense.description.match(/PAYE Tax - (.+)/);
      const empName = nameMatch ? nameMatch[1] : 'Unknown';
      const empId = expense.employeeId || empName.toLowerCase().replace(/\s+/g, '_');
      
      if (!employeeBreakdown[empId]) {
        employeeBreakdown[empId] = {
          employeeId: empId,
          employeeName: empName,
          employeeNumber: 'N/A',
          department: 'N/A',
          totalPaye: 0,
          pendingAmount: 0,
          paidAmount: 0,
          periods: []
        };
      }

      employeeBreakdown[empId].totalPaye += expense.amount;
      
      if (expense.paymentStatus === 'Pending') {
        employeeBreakdown[empId].pendingAmount += expense.amount;
      } else {
        employeeBreakdown[empId].paidAmount += expense.amount;
      }

      // Extract period from notes or description
      const periodMatch = expense.notes?.match(/Period: ([^|]+)/);
      employeeBreakdown[empId].periods.push({
        date: expense.date,
        amount: expense.amount,
        status: expense.paymentStatus,
        period: periodMatch ? periodMatch[1].trim() : expense.date.toLocaleDateString()
      });
    }

    // Convert to array and sort by total PAYE descending
    const breakdownArray = Object.values(employeeBreakdown)
      .sort((a, b) => b.totalPaye - a.totalPaye);

    return NextResponse.json({
      summary: {
        totalPaye,
        pendingPaye,
        paidPaye,
        expenseCount: payeExpenses.length,
        employeeCount: breakdownArray.length
      },
      byEmployee: breakdownArray,
      details: payeExpenses.map(exp => {
        const nameMatch = exp.description.match(/PAYE Tax - (.+)/);
        return {
          id: exp.id,
          date: exp.date,
          employeeName: nameMatch ? nameMatch[1] : 'Unknown',
          employeeNumber: 'N/A',
          department: 'N/A',
          amount: exp.amount,
          status: exp.paymentStatus,
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
