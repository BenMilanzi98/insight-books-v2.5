// app/api/dashboard/payables/route.js
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
    
    const tenantId = user.tenantId;
    const now = new Date();
    
    // Get date range from query parameters
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'month';
    
    // Calculate date range based on the parameter
    let startDate, endDate;
    const today = new Date();
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastWeek':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        startDate = new Date(lastQuarterYear, lastQuarterMonth, 1);
        endDate = new Date(lastQuarterYear, lastQuarterMonth + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last90Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last365Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 365);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    // Get all unpaid expenses within the date range
    // Include expenses that are Pending or Partially paid (these represent money owed to suppliers)
    const expenses = await prisma.expense.findMany({
      where: {
        tenantId,
        paymentStatus: { in: ['Pending', 'Partially'] },
        isDeleted: false, // Exclude soft-deleted expenses
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        paymentStatus: true,
        date: true,
        description: true,
        merchant: true,
        category: true,
        paymentReference: true
      }
    });
    
    // Get supplier bills (from purchase module) within the date range
    const supplierBills = await prisma.supplierBill.findMany({
      where: {
        tenantId,
        status: { in: ['Unpaid', 'Partially Paid'] },
        billDate: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        billNumber: true,
        totalAmount: true,
        amountPaid: true,
        status: true,
        billDate: true,
        dueDate: true,
        supplier: {
          select: {
            supplierName: true
          }
        }
      }
    });
    
    // Calculate aging buckets
    const aging = [
      { range: "0-30 days", amount: 0 },
      { range: "31-60 days", amount: 0 },
      { range: "61-90 days", amount: 0 },
      { range: ">90 days", amount: 0 }
    ];
    
    let total = 0;
    let overdue = 0;
    let notDue = 0;
    
    expenses.forEach(expense => {
      const dueDate = new Date(expense.date);
      // Assuming expenses are due 30 days after the date
      dueDate.setDate(dueDate.getDate() + 30);
      
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      // Calculate the amount owed (total amount minus amount already paid)
      let amountOwed = expense.amount;
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = expense.amount - expense.paidAmount;
      }
      
      total += amountOwed;
      
      if (daysDiff < 0) {
        notDue += amountOwed;
      } else {
        overdue += amountOwed;
        
        // Add to appropriate aging bucket
        if (daysDiff <= 30) {
          aging[0].amount += amountOwed;
        } else if (daysDiff <= 60) {
          aging[1].amount += amountOwed;
        } else if (daysDiff <= 90) {
          aging[2].amount += amountOwed;
        } else {
          aging[3].amount += amountOwed;
        }
      }
    });
    
    // Process supplier bills
    supplierBills.forEach(bill => {
      const balanceDue = (bill.totalAmount || 0) - (bill.amountPaid || 0);
      if (balanceDue > 0) {
        const dueDate = new Date(bill.dueDate || bill.billDate);
        const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
        
        total += balanceDue;
        
        if (daysDiff < 0) {
          notDue += balanceDue;
        } else {
          overdue += balanceDue;
          
          // Add to appropriate aging bucket
          if (daysDiff <= 30) {
            aging[0].amount += balanceDue;
          } else if (daysDiff <= 60) {
            aging[1].amount += balanceDue;
          } else if (daysDiff <= 90) {
            aging[2].amount += balanceDue;
          } else {
            aging[3].amount += balanceDue;
          }
        }
      }
    });
    
    return NextResponse.json({
      accountsPayable: {
        current: total,
        overdue,
        notDue,
        aging
      }
    });
  } catch (error) {
    console.error('Error getting payables data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payables data' },
      { status: 500 }
    );
  }
}