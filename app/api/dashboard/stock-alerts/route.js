// app/api/dashboard/stock-alerts/route.js
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
    
    const tenantId = user.tenantId;
    
    // Get all products (we'll filter for alerts in JavaScript)
    const allProducts = await prisma.product.findMany({
      where: {
        tenantId,
        isService: false, // Only physical products, not services
        stockLevel: { not: null } // Only products with stock level set
      },
      select: {
        id: true,
        name: true,
        stockLevel: true,
        reorderPoint: true,
        sku: true
      }
    });
    
    // Filter products that need alerts
    const productsWithAlerts = allProducts.filter(product => {
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10;
      
      // Show alert if:
      // 1. Out of stock (stockLevel = 0)
      // 2. Stock level is at or below reorder point
      return stockLevel === 0 || stockLevel <= reorderPoint;
    });
    
    console.log(`Found ${allProducts.length} products, ${productsWithAlerts.length} need alerts`);
    
    // Format alerts
    const alerts = productsWithAlerts.map(product => {
      let type, message;
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10;
      
      if (stockLevel === 0) {
        type = 'out_of_stock';
        message = `${product.name} is out of stock`;
      } else if (stockLevel <= reorderPoint) {
        type = 'low_stock';
        message = `${product.name} stock level is below reorder point`;
      } else {
        type = 'warning';
        message = `${product.name} stock is running low`;
      }
      
      return {
        type,
        product: product.name,
        message,
        currentStock: stockLevel,
        reorderPoint: reorderPoint,
        sku: product.sku
      };
    });
    
    return NextResponse.json({
      alerts
    });
  } catch (error) {
    console.error('Error getting stock alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock alerts' },
      { status: 500 }
    );
  }
} 