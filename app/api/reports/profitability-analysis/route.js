// app/api/reports/profitability-analysis/route.js
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
    const groupBy = searchParams.get('groupBy') || 'product'; // product, customer, time
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Get tenant name
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true }
    });
    
    let reportData = {};
    
    if (groupBy === 'product') {
      // Get invoices and sales with items
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
                  cost: true,
                  isService: true
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
                  cost: true,
                  isService: true
                }
              }
            }
          }
        }
      });
      
      // Group by product
      const productData = {};
      
      [...invoices, ...sales].forEach(transaction => {
        transaction.items?.forEach(item => {
          if (!item.product || item.product.isService) return; // Skip services
          
          const productId = item.product.id;
          const productName = item.product.name;
          const cost = item.product.cost || 0;
          const quantity = item.quantity || 0;
          const revenue = item.amount || 0;
          const cogs = cost * quantity;
          const grossProfit = revenue - cogs;
          const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
          
          if (!productData[productId]) {
            productData[productId] = {
              productId,
              productName,
              unitsSold: 0,
              revenue: 0,
              cogs: 0,
              grossProfit: 0,
              margin: 0
            };
          }
          
          productData[productId].unitsSold += quantity;
          productData[productId].revenue += revenue;
          productData[productId].cogs += cogs;
          productData[productId].grossProfit += grossProfit;
        });
      });
      
      // Calculate margins
      Object.values(productData).forEach(product => {
        product.margin = product.revenue > 0 ? (product.grossProfit / product.revenue) * 100 : 0;
      });
      
      // Calculate totals
      const totals = {
        unitsSold: Object.values(productData).reduce((sum, p) => sum + p.unitsSold, 0),
        revenue: Object.values(productData).reduce((sum, p) => sum + p.revenue, 0),
        cogs: Object.values(productData).reduce((sum, p) => sum + p.cogs, 0),
        grossProfit: Object.values(productData).reduce((sum, p) => sum + p.grossProfit, 0),
        margin: 0
      };
      totals.margin = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
      
      reportData = {
        groupBy: 'product',
        data: Object.values(productData).sort((a, b) => b.revenue - a.revenue),
        totals
      };
    } else if (groupBy === 'customer') {
      // Get invoices and sales grouped by customer
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
          },
          items: {
            include: {
              product: {
                select: {
                  cost: true,
                  isService: true
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
          client: {
            select: { id: true, name: true }
          },
          items: {
            include: {
              product: {
                select: {
                  cost: true,
                  isService: true
                }
              }
            }
          }
        }
      });
      
      // Group by customer
      const customerData = {};
      
      [...invoices, ...sales].forEach(transaction => {
        const clientId = transaction.client?.id || 'unknown';
        const clientName = transaction.client?.name || 'Walk-in Customer';
        
        if (!customerData[clientId]) {
          customerData[clientId] = {
            customerId: clientId,
            customerName: clientName,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            margin: 0
          };
        }
        
        transaction.items?.forEach(item => {
          if (!item.product || item.product.isService) return;
          
          const revenue = item.amount || 0;
          const cogs = (item.product.cost || 0) * (item.quantity || 0);
          const grossProfit = revenue - cogs;
          
          customerData[clientId].revenue += revenue;
          customerData[clientId].cogs += cogs;
          customerData[clientId].grossProfit += grossProfit;
        });
      });
      
      // Calculate margins
      Object.values(customerData).forEach(customer => {
        customer.margin = customer.revenue > 0 ? (customer.grossProfit / customer.revenue) * 100 : 0;
      });
      
      // Calculate totals
      const totals = {
        revenue: Object.values(customerData).reduce((sum, c) => sum + c.revenue, 0),
        cogs: Object.values(customerData).reduce((sum, c) => sum + c.cogs, 0),
        grossProfit: Object.values(customerData).reduce((sum, c) => sum + c.grossProfit, 0),
        margin: 0
      };
      totals.margin = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
      
      reportData = {
        groupBy: 'customer',
        data: Object.values(customerData).sort((a, b) => b.revenue - a.revenue),
        totals
      };
    } else if (groupBy === 'time') {
      // Group by month
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
                  cost: true,
                  isService: true
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
                  cost: true,
                  isService: true
                }
              }
            }
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
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            margin: 0
          };
        }
        
        transaction.items?.forEach(item => {
          if (!item.product || item.product.isService) return;
          
          const revenue = item.amount || 0;
          const cogs = (item.product.cost || 0) * (item.quantity || 0);
          const grossProfit = revenue - cogs;
          
          monthlyData[monthKey].revenue += revenue;
          monthlyData[monthKey].cogs += cogs;
          monthlyData[monthKey].grossProfit += grossProfit;
        });
      });
      
      // Calculate margins
      Object.values(monthlyData).forEach(month => {
        month.margin = month.revenue > 0 ? (month.grossProfit / month.revenue) * 100 : 0;
      });
      
      // Calculate totals
      const totals = {
        revenue: Object.values(monthlyData).reduce((sum, m) => sum + m.revenue, 0),
        cogs: Object.values(monthlyData).reduce((sum, m) => sum + m.cogs, 0),
        grossProfit: Object.values(monthlyData).reduce((sum, m) => sum + m.grossProfit, 0),
        margin: 0
      };
      totals.margin = totals.revenue > 0 ? (totals.grossProfit / totals.revenue) * 100 : 0;
      
      reportData = {
        groupBy: 'time',
        data: Object.keys(monthlyData).sort().map(key => monthlyData[key]),
        totals
      };
    }
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      period: {
        startDate,
        endDate
      },
      ...reportData
    });
  } catch (error) {
    console.error('Error generating profitability analysis report:', error);
    return NextResponse.json(
      { error: 'Failed to generate profitability analysis report. Please try again.' },
      { status: 500 }
    );
  }
}

