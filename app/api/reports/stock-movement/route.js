// app/api/reports/stock-movement/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const productId = searchParams.get('productId');
    
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
    
    // Build where clause
    const where = {
      tenantId: user.tenantId,
      createdAt: { gte: start, lte: end }
    };
    
    if (productId) {
      where.productId = productId;
    }
    
    // Get inventory transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            cost: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // Get product(s) for the report
    let products = [];
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId, tenantId: user.tenantId },
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true
        }
      });
      if (product) products.push(product);
    } else {
      // Get all products that have transactions in this period
      const productIds = [...new Set(transactions.map(t => t.productId))];
      products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId: user.tenantId
        },
        select: {
          id: true,
          name: true,
          sku: true,
          cost: true
        }
      });
    }
    
    // Process transactions by product
    const productMovements = await Promise.all(products.map(async (product) => {
      const productTransactions = transactions.filter(t => t.productId === product.id);
      
      // Calculate opening balance (stock level before start date)
      // Get all transactions before the start date to calculate opening balance
      const openingTransactions = await prisma.inventoryTransaction.findMany({
        where: {
          productId: product.id,
          tenantId: user.tenantId,
          createdAt: { lt: start }
        },
        orderBy: { createdAt: 'asc' }
      });
      
      // Calculate opening balance from previous transactions
      let runningBalance = 0;
      openingTransactions.forEach(transaction => {
        const qtyIn = transaction.type === 'Stock In' || transaction.type === 'Purchase' ? transaction.quantity : 0;
        const qtyOut = transaction.type === 'Stock Out' || transaction.type === 'Sale' ? transaction.quantity : 0;
        const adjustment = transaction.type === 'Adjustment' ? transaction.quantity : 0;
        runningBalance += qtyIn - qtyOut + adjustment;
      });
      
      const openingBalance = runningBalance;
      
      const movements = productTransactions.map(transaction => {
        const qtyIn = transaction.type === 'Stock In' || transaction.type === 'Purchase' ? transaction.quantity : 0;
        const qtyOut = transaction.type === 'Stock Out' || transaction.type === 'Sale' ? transaction.quantity : 0;
        const adjustment = transaction.type === 'Adjustment' ? transaction.quantity : 0;
        
        runningBalance += qtyIn - qtyOut + adjustment;
        
        return {
          date: transaction.createdAt,
          transactionType: transaction.type,
          qtyIn: qtyIn > 0 ? qtyIn : null,
          qtyOut: qtyOut > 0 ? qtyOut : null,
          adjustment: adjustment !== 0 ? adjustment : null,
          balance: runningBalance,
          reference: transaction.notes || 'N/A',
          userId: transaction.userId,
          userName: transaction.user?.name || 'N/A'
        };
      });
      
      // Calculate totals
      const totalQtyIn = movements.reduce((sum, m) => sum + (m.qtyIn || 0), 0);
      const totalQtyOut = movements.reduce((sum, m) => sum + (m.qtyOut || 0), 0);
      const netMovement = totalQtyIn - totalQtyOut;
      
      return {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          cost: product.cost
        },
        openingBalance,
        movements,
        totals: {
          qtyIn: totalQtyIn,
          qtyOut: totalQtyOut,
          netMovement
        },
        closingBalance: runningBalance
      };
    }));
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      period: {
        startDate,
        endDate
      },
      productMovements
    });
  } catch (error) {
    console.error('Error generating stock movement report:', error);
    return NextResponse.json(
      { error: 'Failed to generate stock movement report. Please try again.' },
      { status: 500 }
    );
  }
}

