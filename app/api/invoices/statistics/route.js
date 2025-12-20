import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
        tenantId: user.tenantId
      };
      
      // Only add date filter if dates are provided
      if (Object.keys(dateFilter).length > 0) {
        baseFilter.issueDate = dateFilter;
      }
      
      // Get paid invoices count and sum
      const paidInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Paid'
        },
        _count: true,
        _sum: {
          total: true
        }
      });
      
      // Get pending invoices count and sum
      const pendingInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Pending'
        },
        _count: true,
        _sum: {
          total: true
        }
      });
      
      // Get overdue invoices count and sum
      const overdueInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Overdue'
        },
        _count: true,
        _sum: {
          total: true
        }
      });
      
      // Get draft invoices count and sum
      const draftInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Draft'
        },
        _count: true,
        _sum: {
          total: true
        }
      });
      
      // Get partial invoices count and sum
      const partialInvoices = await prisma.invoice.aggregate({
        where: {
          ...baseFilter,
          status: 'Partial'
        },
        _count: true,
        _sum: {
          total: true
        }
      });
      
      // Format currency amounts
      const formatCurrency = (amount) => {
        if (!amount) return '0.00';
        return amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      };
      
      // Return statistics
      return NextResponse.json({
        paid: {
          count: paidInvoices._count,
          amount: formatCurrency(paidInvoices._sum.total)
        },
        pending: {
          count: pendingInvoices._count,
          amount: formatCurrency(pendingInvoices._sum.total)
        },
        overdue: {
          count: overdueInvoices._count,
          amount: formatCurrency(overdueInvoices._sum.total)
        },
        partial: {
          count: partialInvoices._count,
          amount: formatCurrency(partialInvoices._sum.total)
        },
        draft: {
          count: draftInvoices._count,
          amount: formatCurrency(draftInvoices._sum.total)
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