// app/api/reports/sales/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';
import {
  validInvoiceReportWhere,
  validSaleReportWhere,
} from '@/lib/reportingSourceRules';
import {
  invoiceDocumentTaxAmount,
  invoiceItemNetRevenueExTax,
  invoiceNetRevenueTotalExTax,
  saleDocumentTaxAmount,
  saleItemNetRevenueExTax,
  saleNetRevenueTotalExTax,
  roundReportAmount,
} from '@/lib/reportLineNetRevenue';
import { addMoney, multiplyMoney, subtractMoney } from '@/lib/money';

export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'reports.view');
    if (perm) return perm;

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get query parameters (support both request.url and request.nextUrl)
    const url = request.nextUrl ?? request.url;
    const searchParams = typeof url === 'object' && url.searchParams ? url.searchParams : new URL(typeof url === 'string' ? url : url?.toString() || '', 'http://localhost').searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
    
    // Get sales data - filter by branch
    const sales = await prisma.sale.findMany({
      where: addBranchFilter(user, {
        ...validSaleReportWhere(user.tenantId, 'saleDate', start, end)
      }),
      include: {
        items: {
          include: {
            product: true
          }
        },
        client: true
      },
      orderBy: {
        saleDate: 'desc'
      }
    });
    
    // Get invoice data (also considered sales) - filter by branch
    const invoices = await prisma.invoice.findMany({
      where: addBranchFilter(user, {
        ...validInvoiceReportWhere(user.tenantId, 'issueDate', start, end)
      }),
      include: {
        items: {
          include: {
            product: true
          }
        },
        client: true
      },
      orderBy: {
        issueDate: 'desc'
      }
    });
    
    // Group sales by date
    const salesByDate = {};
    
    // Helper function to get the appropriate date key based on groupBy
    const getDateKey = (date, groupByOption) => {
      const d = new Date(date);
      
      switch (groupByOption) {
        case 'day':
          return d.toISOString().split('T')[0]; // YYYY-MM-DD
        case 'week':
          // Get the first day of the week (Sunday)
          const firstDayOfWeek = new Date(d);
          const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
          firstDayOfWeek.setDate(d.getDate() - day);
          return firstDayOfWeek.toISOString().split('T')[0];
        case 'month':
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        default:
          return d.toISOString().split('T')[0];
      }
    };
    
    // Process sales
    sales.forEach(sale => {
      const dateKey = getDateKey(sale.saleDate, groupBy);
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          sales: 0,
          invoices: 0,
          totalRevenue: 0,
          totalTax: 0
        };
      }
      
      salesByDate[dateKey].sales += 1;
      salesByDate[dateKey].totalRevenue = addMoney(salesByDate[dateKey].totalRevenue, saleNetRevenueTotalExTax(sale));
      salesByDate[dateKey].totalTax = addMoney(salesByDate[dateKey].totalTax, saleDocumentTaxAmount(sale));
    });
    
    // Process invoices
    invoices.forEach(invoice => {
      const dateKey = getDateKey(invoice.issueDate, groupBy);
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          sales: 0,
          invoices: 0,
          totalRevenue: 0,
          totalTax: 0
        };
      }
      
      salesByDate[dateKey].invoices += 1;
      salesByDate[dateKey].totalRevenue = addMoney(salesByDate[dateKey].totalRevenue, invoiceNetRevenueTotalExTax(invoice));
      salesByDate[dateKey].totalTax = addMoney(salesByDate[dateKey].totalTax, invoiceDocumentTaxAmount(invoice));
    });
    
    // Analyze sales by product
    const salesByProduct = {};
    
    // Process sale items
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.productId;
        const productName = item.product?.name || 'Unknown Product';
        
        if (!salesByProduct[productId]) {
          salesByProduct[productId] = {
            productId,
            productName,
            quantity: 0,
            revenue: 0
          };
        }
        
        salesByProduct[productId].quantity += item.quantity;
        salesByProduct[productId].revenue = addMoney(salesByProduct[productId].revenue, saleItemNetRevenueExTax(item));
      });
    });
    
    // Process invoice items
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (item.productId) {
          const productId = item.productId;
          const productName = item.product?.name || 'Unknown Product';
          
          if (!salesByProduct[productId]) {
            salesByProduct[productId] = {
              productId,
              productName,
              quantity: 0,
              revenue: 0
            };
          }
          
          salesByProduct[productId].quantity += item.quantity;
          salesByProduct[productId].revenue = addMoney(salesByProduct[productId].revenue, invoiceItemNetRevenueExTax(item));
        }
      });
    });
    
    // Analyze sales by customer
    const salesByCustomer = {};
    
    // Process sales by customer
    sales.forEach(sale => {
      if (sale.clientId) {
        const clientId = sale.clientId;
        const clientName = sale.client?.name || 'Unknown Client';
        
        if (!salesByCustomer[clientId]) {
          salesByCustomer[clientId] = {
            clientId,
            clientName,
            salesCount: 0,
            invoiceCount: 0,
            totalSpent: 0
          };
        }
        
        salesByCustomer[clientId].salesCount += 1;
        salesByCustomer[clientId].totalSpent = addMoney(
          salesByCustomer[clientId].totalSpent,
          saleNetRevenueTotalExTax(sale)
        );
      }
    });
    
    // Process invoices by customer
    invoices.forEach(invoice => {
      const clientId = invoice.clientId;
      const clientName = invoice.client?.name || 'Unknown Client';
      
      if (!salesByCustomer[clientId]) {
        salesByCustomer[clientId] = {
          clientId,
          clientName,
          salesCount: 0,
          invoiceCount: 0,
          totalSpent: 0
        };
      }
      
      salesByCustomer[clientId].invoiceCount += 1;
      salesByCustomer[clientId].totalSpent = addMoney(
        salesByCustomer[clientId].totalSpent,
        invoiceNetRevenueTotalExTax(invoice)
      );
    });
    
    // Calculate totals
    const totalSalesCount = sales.length;
    const totalInvoiceCount = invoices.length;
    const totalRevenue = roundReportAmount(
      addMoney(
        sales.reduce((sum, sale) => addMoney(sum, saleNetRevenueTotalExTax(sale)), 0),
        invoices.reduce((sum, invoice) => addMoney(sum, invoiceNetRevenueTotalExTax(invoice)), 0)
      )
    );
    const grossSales = roundReportAmount(
      addMoney(
        sales.reduce(
          (sum, sale) => addMoney(sum, (sale.items || []).reduce((itemSum, item) => addMoney(itemSum, item.amount), 0)),
          0
        ),
        invoices.reduce(
          (sum, invoice) => addMoney(sum, (invoice.items || []).reduce(
            (itemSum, item) => addMoney(itemSum, multiplyMoney(item.unitPrice, item.quantity)),
            0
          )),
          0
        )
      )
    );
    const totalDiscounts = roundReportAmount(Math.max(0, subtractMoney(grossSales, totalRevenue)));
    const totalTax = roundReportAmount(
      addMoney(
        sales.reduce((sum, sale) => addMoney(sum, saleDocumentTaxAmount(sale)), 0),
        invoices.reduce((sum, invoice) => addMoney(sum, invoiceDocumentTaxAmount(invoice)), 0)
      )
    );
    
    // Sort the salesByDate array by date
    const salesByDateArray = Object.values(salesByDate).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
    
    // Sort salesByProduct by revenue (descending)
    const salesByProductArray = Object.values(salesByProduct).sort((a, b) => 
      b.revenue - a.revenue
    );
    
    // Sort salesByCustomer by totalSpent (descending)
    const salesByCustomerArray = Object.values(salesByCustomer).sort((a, b) => 
      b.totalSpent - a.totalSpent
    );
    
    return NextResponse.json({
      period: {
        startDate,
        endDate
      },
      summary: {
        totalSalesCount,
        totalInvoiceCount,
        grossSales,
        totalDiscounts,
        totalRevenue,
        netSales: totalRevenue,
        totalTax,
        averageSaleValue: (totalSalesCount + totalInvoiceCount) > 0
          ? totalRevenue / (totalSalesCount + totalInvoiceCount)
          : 0
      },
      salesByDate: salesByDateArray,
      salesByProduct: salesByProductArray,
      salesByCustomer: salesByCustomerArray,
      groupBy
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales report. Please try again.' },
      { status: 500 }
    );
  }
}
