import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { parseMoney } from '@/lib/money';

export async function GET(request) {
    try {
      // Get user from session
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const { searchParams } = new URL(request.url);
      
      // Parse date parameters
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      
      // Build date filter - make it more flexible
      const dateFilter = {};
      if (dateFrom) {
        dateFilter.gte = new Date(dateFrom);
      }
      if (dateTo) {
        dateFilter.lte = new Date(dateTo);
      }
      
      // Base query filter for tenant's invoices
      const baseFilter = {
        tenantId: user.tenantId,
        isDeleted: false,
        isReversal: false
      };
      
      // Only add date filter if dates are provided
      if (Object.keys(dateFilter).length > 0) {
        baseFilter.issueDate = dateFilter;
      }

      // Start of today (UTC) for overdue vs pending split: pending = not yet due, overdue = past due
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      
      // Paid: status = Paid — true total amount of paid invoices
      const paidInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Paid'
        },
        _count: true,
        _sum: { total: true }
      });
      
      // Pending: status = Pending AND dueDate >= today (not yet overdue)
      const pendingInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Pending',
          dueDate: { gte: startOfToday }
        },
        _count: true,
        _sum: { total: true }
      });
      
      // Overdue: status = Overdue OR (status = Pending AND dueDate < today)
      const overdueInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          OR: [
            { status: 'Overdue' },
            { status: 'Pending', dueDate: { lt: startOfToday } }
          ]
        },
        _count: true,
        _sum: { total: true }
      });
      
      // Draft (for completeness; not shown on cards)
      const draftInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Draft'
        },
        _count: true,
        _sum: { total: true }
      });
      
      // Partial: status = Partial — true total amount of partially paid invoices
      const partialInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Partial'
        },
        _count: true,
        _sum: { total: true }
      });
      
      // Return statistics with numeric amounts (frontend formats for display)
      return NextResponse.json({
        paid: {
          count: paidInvoices._count,
          amount: parseMoney(paidInvoices._sum?.total)
        },
        pending: {
          count: pendingInvoices._count,
          amount: parseMoney(pendingInvoices._sum?.total)
        },
        overdue: {
          count: overdueInvoices._count,
          amount: parseMoney(overdueInvoices._sum?.total)
        },
        partial: {
          count: partialInvoices._count,
          amount: parseMoney(partialInvoices._sum?.total)
        },
        draft: {
          count: draftInvoices._count,
          amount: parseMoney(draftInvoices._sum?.total)
        }
      });
    } catch (error) {
      console.error('Error fetching invoice statistics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invoice statistics. Please try again.' },
        { status: 500 }
      );
    }
  }