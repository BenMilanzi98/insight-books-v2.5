// app/api/dashboard/payables/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

// Prevent caching to ensure fresh data on branch switch
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const accessible = await getAccessibleTenantIdsForUser(user);
    const scope = parseDashboardTenantScope(searchParams, user, accessible);
    if (!scope.ok) {
      return NextResponse.json(
        { error: scope.error || 'Invalid business scope' },
        { status: 400 }
      );
    }
    const { tenantIds, branchScoped } = scope;
    const tw = tenantWhereIn(tenantIds);
    const userQ = userForDashboardBranchFilter(user, branchScoped);

    const now = new Date();
    
    // Get all Posted GoodsReceipt records (these represent inventory received that needs to be paid for)
    // Filter by branch through goods receipt items -> products -> branchId
    // Note: GoodsReceipt model doesn't have branchId, so we filter through product relationships
    const goodsReceiptWhere = {
      ...tw,
      status: 'Posted'
    };
    
    // If user has a branch selected, filter goods receipts by products in that branch
    if (branchScoped && user?.currentBranchId) {
      goodsReceiptWhere.items = {
        some: {
          product: {
            branchId: user.currentBranchId
          }
        }
      };
    }
    
    const postedReceipts = await prisma.goodsReceipt.findMany({
      where: goodsReceiptWhere,
      select: {
        id: true,
        receiptNumber: true,
        receiptDate: true,
        totalAmount: true,
        supplier: {
          select: {
            id: true,
            supplierName: true
          }
        },
        supplierBills: {
          // Exclude settled/cancelled; balance due is applied in JS (avoids the old over-broad OR that matched almost every bill)
          where: {
            ...tw,
            status: { notIn: ['Paid', 'Cancelled'] },
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
        }
      }
    });
    
    // Get all Expenses with Pending or Partially paid status
    const expenses = await prisma.expense.findMany({
      where: addBranchFilter(userQ, {
        ...tw,
        paymentStatus: { in: ['Pending', 'Partially'] },
        isDeleted: false
      }),
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
    
    // Process supplier bills from posted receipts
    postedReceipts.forEach(receipt => {
      receipt.supplierBills.forEach(bill => {
        const balanceDue = subtractMoney(bill.totalAmount, bill.amountPaid);
        if (balanceDue > 0) {
          if (!bill.dueDate) {
            console.warn(`Bill ${bill.billNumber} has no due date, skipping aging calculation`);
            return;
          }
          const dueDate = new Date(bill.dueDate);
          if (isNaN(dueDate.getTime())) {
            console.warn(`Bill ${bill.billNumber} has invalid due date: ${bill.dueDate}`);
            return;
          }
          
          const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
          
          total = addMoney(total, balanceDue);
          
          if (daysDiff < 0) {
            notDue = addMoney(notDue, balanceDue);
            aging[0].amount = addMoney(aging[0].amount, balanceDue); // Not yet due goes into 0-30 days bucket
          } else {
            overdue = addMoney(overdue, balanceDue);
            
            // Add to appropriate aging bucket
            if (daysDiff <= 30) {
              aging[0].amount = addMoney(aging[0].amount, balanceDue);
            } else if (daysDiff <= 60) {
              aging[1].amount = addMoney(aging[1].amount, balanceDue);
            } else if (daysDiff <= 90) {
              aging[2].amount = addMoney(aging[2].amount, balanceDue);
            } else {
              aging[3].amount = addMoney(aging[3].amount, balanceDue);
            }
          }
        }
      });
    });
    
    // Process expenses
    expenses.forEach(expense => {
      // Calculate the amount owed (total amount minus amount already paid)
      let amountOwed = parseMoney(expense.amount);
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = subtractMoney(expense.amount, expense.paidAmount);
      }
      
      if (amountOwed <= 0) {
        return;
      }
      
      if (!expense.date) {
        console.warn(`Expense ${expense.id} has no date, skipping aging calculation`);
        return;
      }
      
      const expenseDate = new Date(expense.date);
      if (isNaN(expenseDate.getTime())) {
        console.warn(`Expense ${expense.id} has invalid date: ${expense.date}`);
        return;
      }
      
      // For expenses, assume they are due 30 days after the expense date
      const dueDate = new Date(expenseDate);
      dueDate.setDate(dueDate.getDate() + 30);
      
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      total = addMoney(total, amountOwed);
      
      if (daysDiff < 0) {
        notDue = addMoney(notDue, amountOwed);
        aging[0].amount = addMoney(aging[0].amount, amountOwed); // Not yet due goes into 0-30 days bucket
      } else {
        overdue = addMoney(overdue, amountOwed);
        
        // Add to appropriate aging bucket
        if (daysDiff <= 30) {
          aging[0].amount = addMoney(aging[0].amount, amountOwed);
        } else if (daysDiff <= 60) {
          aging[1].amount = addMoney(aging[1].amount, amountOwed);
        } else if (daysDiff <= 90) {
          aging[2].amount = addMoney(aging[2].amount, amountOwed);
        } else {
          aging[3].amount = addMoney(aging[3].amount, amountOwed);
        }
      }
    });
    
    // Prepare outstanding payables list for detailed view
    const outstandingPayables = [];
    
    // Add supplier bills from posted receipts
    postedReceipts.forEach(receipt => {
      receipt.supplierBills.forEach(bill => {
        const balanceDue = subtractMoney(bill.totalAmount, bill.amountPaid);
        if (balanceDue > 0) {
          if (!bill.dueDate) {
            return;
          }
          const dueDate = new Date(bill.dueDate);
          if (isNaN(dueDate.getTime())) {
            return;
          }
          
          const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
          
          let payableStatus = 'Pending';
          if (daysDiff < 0) {
            payableStatus = 'Not Due';
          } else if (daysDiff > 0) {
            payableStatus = 'Overdue';
          } else if (bill.status === 'Partially Paid' || bill.status === 'Partial') {
            payableStatus = 'Partial';
          }
          
          outstandingPayables.push({
            id: bill.id,
            type: 'bill',
            referenceNumber: bill.billNumber,
            supplierId: receipt.supplier?.id,
            supplierName: bill.supplier?.supplierName || receipt.supplier?.supplierName || 'Unknown',
            receiptNumber: receipt.receiptNumber,
            receiptDate: receipt.receiptDate,
            billDate: bill.billDate,
            dueDate: bill.dueDate,
            total: bill.totalAmount,
            amountPaid: bill.amountPaid || 0,
            amountOwed: balanceDue,
            status: payableStatus,
            daysPastDue: daysDiff > 0 ? daysDiff : 0,
            originalStatus: bill.status
          });
        }
      });
    });
    
    // Add expenses
    expenses.forEach(expense => {
      let amountOwed = parseMoney(expense.amount);
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = subtractMoney(expense.amount, expense.paidAmount);
      }
      
      if (amountOwed <= 0) {
        return;
      }
      
      if (!expense.date) {
        return;
      }
      
      const expenseDate = new Date(expense.date);
      if (isNaN(expenseDate.getTime())) {
        return;
      }
      
      const dueDate = new Date(expenseDate);
      dueDate.setDate(dueDate.getDate() + 30);
      
      const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let payableStatus = 'Pending';
      if (daysDiff < 0) {
        payableStatus = 'Not Due';
      } else if (daysDiff > 0) {
        payableStatus = 'Overdue';
      } else if (expense.paymentStatus === 'Partially') {
        payableStatus = 'Partial';
      }
      
      outstandingPayables.push({
        id: expense.id,
        type: 'expense',
        referenceNumber: expense.paymentReference || `EXP-${expense.id.substring(0, 8)}`,
        supplierId: null,
        supplierName: expense.merchant || 'N/A',
        receiptNumber: null,
        receiptDate: null,
        billDate: expense.date,
        dueDate: dueDate.toISOString(),
        total: expense.amount,
        amountPaid: expense.paidAmount || 0,
        amountOwed: amountOwed,
        status: payableStatus,
        daysPastDue: daysDiff > 0 ? daysDiff : 0,
        originalStatus: expense.paymentStatus,
        description: expense.description,
        category: expense.category
      });
    });
    
    return NextResponse.json({
      accountsPayable: {
        current: total,
        overdue,
        notDue,
        aging
      },
      payables: outstandingPayables
    });
  } catch (error) {
    console.error('Error getting payables data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payables data' },
      { status: 500 }
    );
  }
}