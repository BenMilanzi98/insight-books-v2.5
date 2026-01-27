// app/api/reports/sales-analysis/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'time'; // time, product, customer, category
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Get tenant name and logo
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true, logoUrl: true }
    });
    
    let reportData = {};
    
    if (groupBy === 'time') {
      // Group by month - filter by branch
      const invoices = await prisma.invoice.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          issueDate: { gte: start, lte: end },
          status: { in: ['Paid', 'Completed', 'Pending', 'Partially Paid'] },
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          client: {
            select: { name: true }
          }
        }
      });
      
      const sales = await prisma.sale.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          saleDate: { gte: start, lte: end },
          status: 'completed',
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          client: {
            select: { name: true }
          }
        }
      });
      
      // Group by month
      const monthlyData = {};
      
      [...invoices, ...sales].forEach(transaction => {
        const date = transaction.issueDate || transaction.saleDate;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthName,
            invoiceCount: 0,
            salesAmount: 0,
            avgInvoice: 0
          };
        }
        
        monthlyData[monthKey].invoiceCount += 1;
        monthlyData[monthKey].salesAmount += transaction.total || 0;
      });
      
      // Calculate averages and percentage changes
      const months = Object.keys(monthlyData).sort();
      months.forEach((monthKey, index) => {
        const data = monthlyData[monthKey];
        data.avgInvoice = data.invoiceCount > 0 ? data.salesAmount / data.invoiceCount : 0;
        
        if (index > 0) {
          const prevMonth = monthlyData[months[index - 1]];
          const change = prevMonth.salesAmount > 0 
            ? ((data.salesAmount - prevMonth.salesAmount) / prevMonth.salesAmount) * 100 
            : 0;
          data.percentChange = change;
        } else {
          data.percentChange = null;
        }
      });
      
      reportData = {
        groupBy: 'time',
        data: months.map(key => monthlyData[key]),
        totals: {
          totalInvoices: months.reduce((sum, key) => sum + monthlyData[key].invoiceCount, 0),
          totalSales: months.reduce((sum, key) => sum + monthlyData[key].salesAmount, 0),
          avgInvoice: months.length > 0 
            ? months.reduce((sum, key) => sum + monthlyData[key].salesAmount, 0) / 
              months.reduce((sum, key) => sum + monthlyData[key].invoiceCount, 0)
            : 0
        }
      };
    } else if (groupBy === 'product' || groupBy === 'category') {
      // Group by product or category
      const invoices = await prisma.invoice.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          issueDate: { gte: start, lte: end },
          status: { in: ['Paid', 'Completed', 'Pending', 'Partially Paid'] },
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  cost: true
                }
              }
            }
          }
        }
      });
      
      const sales = await prisma.sale.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          saleDate: { gte: start, lte: end },
          status: 'completed',
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  cost: true
                }
              }
            }
          }
        }
      });
      
      const groupedData = {};
      
      [...invoices, ...sales].forEach(transaction => {
        transaction.items?.forEach(item => {
          const key = groupBy === 'product' 
            ? item.product?.id || 'unknown'
            : item.product?.category || 'Uncategorized';
          
          if (!groupedData[key]) {
            groupedData[key] = {
              key,
              name: groupBy === 'product' ? item.product?.name || 'Unknown' : item.product?.category || 'Uncategorized',
              salesCount: 0,
              quantitySold: 0,
              revenue: 0
            };
          }
          
          groupedData[key].salesCount += 1;
          groupedData[key].quantitySold += item.quantity || 0;
          groupedData[key].revenue += item.amount || 0;
        });
      });
      
      const totalRevenue = Object.values(groupedData).reduce((sum, item) => sum + item.revenue, 0);
      
      reportData = {
        groupBy,
        data: Object.values(groupedData).map(item => ({
          ...item,
          percentOfTotal: totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0
        })),
        totals: {
          totalSales: Object.values(groupedData).reduce((sum, item) => sum + item.salesCount, 0),
          totalQuantity: Object.values(groupedData).reduce((sum, item) => sum + item.quantitySold, 0),
          totalRevenue
        }
      };
    } else if (groupBy === 'customer') {
      // Group by customer
      const invoices = await prisma.invoice.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          issueDate: { gte: start, lte: end },
          status: { in: ['Paid', 'Completed', 'Pending', 'Partially Paid'] },
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          client: {
            select: { id: true, name: true }
          }
        }
      });
      
      const sales = await prisma.sale.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          saleDate: { gte: start, lte: end },
          status: 'completed',
          voidedAt: null,
          refundedAt: null
        }),
        include: {
          client: {
            select: { id: true, name: true }
          }
        }
      });
      
      const customerData = {};
      
      [...invoices, ...sales].forEach(transaction => {
        const clientId = transaction.client?.id || 'unknown';
        const clientName = transaction.client?.name || 'Walk-in Customer';
        
        if (!customerData[clientId]) {
          customerData[clientId] = {
            customerId: clientId,
            customerName: clientName,
            orderCount: 0,
            totalSales: 0,
            avgOrder: 0
          };
        }
        
        customerData[clientId].orderCount += 1;
        customerData[clientId].totalSales += transaction.total || 0;
      });
      
      // Calculate averages and percentages
      const totalSales = Object.values(customerData).reduce((sum, c) => sum + c.totalSales, 0);
      Object.values(customerData).forEach(customer => {
        customer.avgOrder = customer.orderCount > 0 ? customer.totalSales / customer.orderCount : 0;
        customer.percentOfTotal = totalSales > 0 ? (customer.totalSales / totalSales) * 100 : 0;
      });
      
      // Sort by total sales descending
      const sortedCustomers = Object.values(customerData)
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 10); // Top 10
      
      reportData = {
        groupBy: 'customer',
        data: sortedCustomers.map((customer, index) => ({
          ...customer,
          rank: index + 1
        })),
        totals: {
          totalCustomers: Object.keys(customerData).length,
          totalOrders: Object.values(customerData).reduce((sum, c) => sum + c.orderCount, 0),
          totalSales
        }
      };
    }
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      logoUrl: tenant?.logoUrl || null,
      period: {
        startDate,
        endDate
      },
      ...reportData
    });
  } catch (error) {
    console.error('Error generating sales analysis report:', error);
    return NextResponse.json(
      { error: 'Failed to generate sales analysis report. Please try again.' },
      { status: 500 }
    );
  }
}

