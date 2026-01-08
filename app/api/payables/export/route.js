// app/api/payables/export/route.js
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
    const searchTerm = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'All';

    const now = new Date();

    // Get all Posted GoodsReceipt records
    const postedReceipts = await prisma.goodsReceipt.findMany({
      where: {
        tenantId: user.tenantId,
        status: 'Posted'
      },
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
          where: {
            OR: [
              { status: { in: ['Unpaid', 'Partially Paid', 'Partial'] } }
            ]
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
      where: {
        tenantId: user.tenantId,
        paymentStatus: { in: ['Pending', 'Partially'] },
        isDeleted: false
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

    // Process supplier bills from posted receipts
    const outstandingBills = [];
    postedReceipts.forEach(receipt => {
      receipt.supplierBills.forEach(bill => {
        const balanceDue = (bill.totalAmount || 0) - (bill.amountPaid || 0);
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
          
          outstandingBills.push({
            id: bill.id,
            type: 'bill',
            referenceNumber: bill.billNumber,
            supplierName: bill.supplier?.supplierName || receipt.supplier?.supplierName || 'Unknown',
            receiptNumber: receipt.receiptNumber,
            receiptDate: receipt.receiptDate,
            billDate: bill.billDate,
            dueDate: bill.dueDate,
            total: bill.totalAmount,
            amountPaid: bill.amountPaid || 0,
            amountOwed: balanceDue,
            status: payableStatus,
            daysPastDue: daysDiff > 0 ? daysDiff : 0
          });
        }
      });
    });

    // Process expenses
    const outstandingExpenses = expenses.map(expense => {
      let amountOwed = parseFloat(expense.amount || 0);
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = parseFloat(expense.amount || 0) - parseFloat(expense.paidAmount || 0);
      }
      
      if (amountOwed <= 0) {
        return null;
      }
      
      if (!expense.date) {
        return null;
      }
      
      const expenseDate = new Date(expense.date);
      if (isNaN(expenseDate.getTime())) {
        return null;
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
      
      return {
        id: expense.id,
        type: 'expense',
        referenceNumber: expense.paymentReference || `EXP-${expense.id.substring(0, 8)}`,
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
        description: expense.description,
        category: expense.category
      };
    }).filter(exp => exp !== null);

    // Combine all outstanding payables
    let allPayables = [...outstandingBills, ...outstandingExpenses];

    // Apply search filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      allPayables = allPayables.filter(payable =>
        payable.referenceNumber?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.supplierName?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
        payable.receiptNumber?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      allPayables = allPayables.filter(payable => {
        if (statusFilter === 'Overdue') {
          return payable.daysPastDue > 0;
        }
        if (statusFilter === 'Not Due') {
          return payable.daysPastDue === 0 && payable.status === 'Not Due';
        }
        if (statusFilter === 'Pending') {
          return payable.status === 'Pending';
        }
        if (statusFilter === 'Partial') {
          return payable.status === 'Partial';
        }
        return true;
      });
    }

    // Helper function to format currency
    const formatCurrency = (amount) => `MWK ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

    // Generate CSV content
    const csvRows = [
      ['ACCOUNTS PAYABLE EXPORT'],
      [`Export Date: ${formatDate(now)}`],
      [],
      ['Reference Number', 'Type', 'Supplier/Vendor', 'Receipt Number', 'Date', 'Due Date', 'Total Amount (MWK)', 'Amount Paid (MWK)', 'Outstanding Amount (MWK)', 'Status', 'Days Past Due']
    ];

    allPayables.forEach(payable => {
      csvRows.push([
        payable.referenceNumber || 'N/A',
        payable.type === 'bill' ? 'Bill' : 'Expense',
        payable.supplierName || 'N/A',
        payable.receiptNumber || 'N/A',
        formatDate(payable.billDate || payable.receiptDate),
        formatDate(payable.dueDate),
        formatCurrency(payable.total),
        formatCurrency(payable.amountPaid),
        formatCurrency(payable.amountOwed),
        payable.status || 'N/A',
        payable.daysPastDue > 0 ? payable.daysPastDue.toString() : '0'
      ]);
    });

    // Add summary
    const totalOutstanding = allPayables.reduce((sum, p) => sum + p.amountOwed, 0);
    const totalOverdue = allPayables.filter(p => p.daysPastDue > 0).reduce((sum, p) => sum + p.amountOwed, 0);
    const totalNotDue = allPayables.filter(p => p.daysPastDue === 0 && p.status === 'Not Due').reduce((sum, p) => sum + p.amountOwed, 0);

    csvRows.push(
      [],
      ['PAYABLES SUMMARY'],
      [`Export Date: ${formatDate(now)}`],
      [`Total Outstanding Payables: ${allPayables.length}`],
      [`Total Outstanding Amount: ${formatCurrency(totalOutstanding)}`],
      [`Total Overdue Amount: ${formatCurrency(totalOverdue)}`],
      [`Total Not Due Amount: ${formatCurrency(totalNotDue)}`]
    );

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const filename = `accounts_payable_export_${formatDate(now).replace(/\s/g, '_')}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="accounts_payable_export_${formatDate(now).replace(/\s/g, '_')}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting payables:', error);
    return NextResponse.json(
      { error: 'Failed to export payables data. Please try again.' },
      { status: 500 }
    );
  }
}

