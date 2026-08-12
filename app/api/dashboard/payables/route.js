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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CLOSED_BILL_STATUSES = ['Draft', 'Cancelled', 'Paid'];

function agingIndex(daysPastDue) {
  if (daysPastDue <= 30) return 0;
  if (daysPastDue <= 60) return 1;
  if (daysPastDue <= 90) return 2;
  return 3;
}

function bucketPayable(now, dueDate) {
  const due = dueDate ? new Date(dueDate) : now;
  const valid = !Number.isNaN(due.getTime());
  const effectiveDue = valid ? due : now;
  const daysDiff = Math.floor((now - effectiveDue) / (1000 * 60 * 60 * 24));
  return {
    daysDiff,
    daysPastDue: daysDiff > 0 ? daysDiff : 0,
    overdue: daysDiff > 0,
    notDue: daysDiff < 0,
  };
}

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
    const branchId = branchScoped ? user?.currentBranchId : null;

    const now = new Date();

    const billWhere = {
      ...tw,
      status: { notIn: CLOSED_BILL_STATUSES },
    };
    if (branchId) {
      billWhere.OR = [
        { goodsReceiptId: null },
        {
          goodsReceipt: {
            items: { some: { product: { branchId } } },
          },
        },
      ];
    }

    const [bills, expenses] = await Promise.all([
      prisma.supplierBill.findMany({
        where: billWhere,
        select: {
          id: true,
          billNumber: true,
          totalAmount: true,
          amountPaid: true,
          status: true,
          billDate: true,
          dueDate: true,
          goodsReceiptId: true,
          goodsReceipt: {
            select: { receiptNumber: true, receiptDate: true },
          },
          supplier: {
            select: { id: true, supplierName: true },
          },
        },
      }),
      prisma.expense.findMany({
        where: addBranchFilter(userQ, {
          ...tw,
          paymentStatus: { in: ['Pending', 'Partially'] },
          isDeleted: false,
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
          paymentReference: true,
        },
      }),
    ]);

    const aging = [
      { range: '0-30 days', amount: 0 },
      { range: '31-60 days', amount: 0 },
      { range: '61-90 days', amount: 0 },
      { range: '>90 days', amount: 0 },
    ];

    let total = 0;
    let overdue = 0;
    let notDue = 0;
    const outstandingPayables = [];

    for (const bill of bills) {
      const balanceDue = subtractMoney(bill.totalAmount, bill.amountPaid || 0);
      if (balanceDue <= 0) continue;

      const bucket = bucketPayable(now, bill.dueDate);
      total = addMoney(total, balanceDue);
      aging[agingIndex(bucket.daysPastDue)].amount = addMoney(
        aging[agingIndex(bucket.daysPastDue)].amount,
        balanceDue
      );
      if (bucket.overdue) overdue = addMoney(overdue, balanceDue);
      if (bucket.notDue) notDue = addMoney(notDue, balanceDue);

      let payableStatus = 'Pending';
      if (bucket.notDue) payableStatus = 'Not Due';
      else if (bucket.overdue) payableStatus = 'Overdue';
      else if (['Partially Paid', 'Partial'].includes(bill.status)) payableStatus = 'Partial';

      outstandingPayables.push({
        id: bill.id,
        type: 'bill',
        referenceNumber: bill.billNumber,
        supplierId: bill.supplier?.id,
        supplierName: bill.supplier?.supplierName || 'Unknown',
        receiptNumber: bill.goodsReceipt?.receiptNumber || null,
        receiptDate: bill.goodsReceipt?.receiptDate || null,
        billDate: bill.billDate,
        dueDate: bill.dueDate || now.toISOString(),
        total: bill.totalAmount,
        amountPaid: bill.amountPaid || 0,
        amountOwed: balanceDue,
        status: payableStatus,
        daysPastDue: bucket.daysPastDue,
        originalStatus: bill.status,
      });
    }

    for (const expense of expenses) {
      let amountOwed = parseMoney(expense.amount);
      if (expense.paymentStatus === 'Partially' && expense.paidAmount) {
        amountOwed = subtractMoney(expense.amount, expense.paidAmount);
      }
      if (amountOwed <= 0 || !expense.date) continue;

      const expenseDate = new Date(expense.date);
      if (Number.isNaN(expenseDate.getTime())) continue;
      const dueDate = new Date(expenseDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const bucket = bucketPayable(now, dueDate);
      total = addMoney(total, amountOwed);
      aging[agingIndex(bucket.daysPastDue)].amount = addMoney(
        aging[agingIndex(bucket.daysPastDue)].amount,
        amountOwed
      );
      if (bucket.overdue) overdue = addMoney(overdue, amountOwed);
      if (bucket.notDue) notDue = addMoney(notDue, amountOwed);

      let payableStatus = 'Pending';
      if (bucket.notDue) payableStatus = 'Not Due';
      else if (bucket.overdue) payableStatus = 'Overdue';
      else if (expense.paymentStatus === 'Partially') payableStatus = 'Partial';

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
        daysPastDue: bucket.daysPastDue,
        originalStatus: expense.paymentStatus,
        description: expense.description,
        category: expense.category,
      });
    }

    return NextResponse.json({
      accountsPayable: {
        current: total,
        overdue,
        notDue,
        aging,
      },
      payables: outstandingPayables,
      glVerification:
        tenantIds.length === 1
          ? (
              await import('@/lib/apAgingService').then((m) =>
                m.generateAPAgingFromTransactions(
                  tenantIds[0],
                  new Date(),
                  branchScoped ? userQ.currentBranchId : null
                )
              )
            ).verification
          : null,
    });
  } catch (error) {
    console.error('Error getting payables data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payables data' },
      { status: 500 }
    );
  }
}
