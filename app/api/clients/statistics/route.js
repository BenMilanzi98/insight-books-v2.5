// app/api/clients/statistics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addMoney, moneyLessOrEqual, subtractMoney } from '@/lib/money';

// GET - Fetch client statistics
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
    
    // Count all clients by persisted status
    const [totalClients, activeCount, inactiveCount] = await Promise.all([
      prisma.client.count({ where: { tenantId: user.tenantId } }),
      prisma.client.count({ where: { tenantId: user.tenantId, isActive: true } }),
      prisma.client.count({ where: { tenantId: user.tenantId, isActive: false } }),
    ]);
    
    // Get all invoices for the tenant
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: user.tenantId
      },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        },
        payments: true
      }
    });
    
    // Get all sales for the tenant
    const sales = await prisma.sale.findMany({
      where: {
        tenantId: user.tenantId
      },
      select: {
        total: true
      }
    });
    
    // Calculate total billed amount (invoices + sales)
    const totalBilledFromInvoices = invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);
    const totalBilledFromSales = sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);
    const totalBilled = addMoney(totalBilledFromInvoices, totalBilledFromSales);
    
    // Calculate total paid amount
    const totalPaid = invoices.reduce((sum, invoice) => {
      return addMoney(sum, invoice.payments.reduce((paymentSum, payment) => addMoney(paymentSum, payment.amount), 0));
    }, 0);
    
    // Calculate outstanding amount
    const totalOutstanding = subtractMoney(totalBilled, totalPaid);
    
    // Get clients and their invoice + sales statistics
    const clients = await prisma.client.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        isActive: true,
        invoices: {
          select: {
            id: true,
            status: true,
            total: true,
            dueDate: true,
            payments: {
              select: {
                amount: true
              }
            }
          }
        },
        sales: {
          select: {
            id: true,
            status: true,
            total: true
          }
        }
      }
    });
    
    // Calculate statistics for each client
    const clientStats = clients.map(client => {
      // Total billed amount (invoices + sales)
      const clientTotalBilledFromInvoices = client.invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);
      const clientTotalBilledFromSales = client.sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);
      const clientTotalBilled = addMoney(clientTotalBilledFromInvoices, clientTotalBilledFromSales);
      
      // Total paid amount (only from invoices)
      const clientTotalPaid = client.invoices.reduce((sum, invoice) => {
        return addMoney(sum, invoice.payments.reduce((paymentSum, payment) => addMoney(paymentSum, payment.amount), 0));
      }, 0);
      
      // Outstanding amount (only from invoices, as sales are typically paid immediately)
      const clientOutstanding = subtractMoney(clientTotalBilledFromInvoices, clientTotalPaid);
      
      // Has overdue invoices
      const hasOverdueInvoices = client.invoices.some(invoice => 
        invoice.status === 'overdue' || 
        (invoice.status === 'sent' && new Date(invoice.dueDate) < new Date() && 
         !moneyLessOrEqual(invoice.total, invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0)))
      );
      
      return {
        id: client.id,
        name: client.name,
        isActive: client.isActive !== false,
        totalBilled: clientTotalBilled,
        totalPaid: clientTotalPaid,
        outstanding: clientOutstanding,
        hasOverdueInvoices,
        invoiceCount: client.invoices.length,
        salesCount: client.sales.length
      };
    });
    
    // Get clients with outstanding balance
    const clientsWithOutstanding = clientStats
      .filter(client => client.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
    
    // Get top clients by revenue
    const topClientsByRevenue = [...clientStats]
      .sort((a, b) => b.totalBilled - a.totalBilled)
      .slice(0, 5);
    
    // Return statistics
    return NextResponse.json({
      activeCount,
      inactiveCount,
      totalClients,
      totalBilled,
      totalOutstanding,
      topClientsByRevenue: topClientsByRevenue.map(client => ({
        id: client.id,
        name: client.name,
        totalBilled: client.totalBilled
      })),
      overdueClients: clientsWithOutstanding.slice(0, 5).map(client => ({
        id: client.id,
        name: client.name,
        outstandingAmount: client.outstanding
      }))
    });
  } catch (error) {
    console.error('Error fetching client statistics:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch client statistics. Please try again.',
        ...(process.env.NODE_ENV === 'development'
          ? { detail: error?.message || String(error) }
          : {}),
      },
      { status: 500 }
    );
  }
}