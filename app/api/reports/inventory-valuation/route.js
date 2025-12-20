// app/api/reports/inventory-valuation/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get products with inventory
    const products = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isService: false
      },
      include: {
        inventoryTransactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10 // Get the most recent transactions only
        }
      }
    });
    
    // Calculate inventory value
    let totalInventoryValue = 0;
    let totalInventoryCount = 0;
    
    const inventoryItems = products.map(product => {
      const stockValue = (product.stockLevel || 0) * (product.cost || 0);
      totalInventoryValue += stockValue;
      totalInventoryCount += product.stockLevel || 0;
      
      // Determine stock status
      let stockStatus = 'In Stock';
      if (product.stockLevel <= 0) {
        stockStatus = 'Out of Stock';
      } else if (product.reorderPoint && product.stockLevel <= product.reorderPoint) {
        stockStatus = 'Low Stock';
      }
      
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        stockLevel: product.stockLevel || 0,
        cost: product.cost || 0,
        stockValue,
        reorderPoint: product.reorderPoint,
        stockStatus,
        recentTransactions: product.inventoryTransactions
      };
    });
    
    // Get low stock items
    const lowStockItems = inventoryItems.filter(item => 
      item.stockStatus === 'Low Stock' || item.stockStatus === 'Out of Stock'
    );
    
    // Group by category
    const inventoryByCategory = {};
    
    inventoryItems.forEach(item => {
      const category = item.category || 'Uncategorized';
      
      if (!inventoryByCategory[category]) {
        inventoryByCategory[category] = {
          category,
          itemCount: 0,
          totalValue: 0,
          items: []
        };
      }
      
      inventoryByCategory[category].itemCount += 1;
      inventoryByCategory[category].totalValue += item.stockValue;
      inventoryByCategory[category].items.push(item);
    });
    
    // Get recent inventory transactions
    const recentTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        tenantId: user.tenantId
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true
          }
        },
        user: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });
    
    return NextResponse.json({
      summary: {
        totalInventoryValue,
        totalInventoryCount,
        productCount: products.length,
        lowStockCount: lowStockItems.length
      },
      inventoryItems: inventoryItems.sort((a, b) => b.stockValue - a.stockValue),
      inventoryByCategory: Object.values(inventoryByCategory),
      lowStockItems,
      recentTransactions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating inventory valuation report:', error);
    return NextResponse.json(
      { error: 'Failed to generate inventory report. Please try again.' },
      { status: 500 }
    );
  }
}