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
    
    // Get all products for this tenant that are not services and not deleted
    const allProducts = await prisma.product.findMany({
      where: {
        tenantId,
        isService: false, // Only physical products, not services
        isDeleted: false // Exclude soft-deleted products
      },
      select: {
        id: true,
        name: true,
        stockLevel: true,
        reorderPoint: true,
        sku: true,
        category: true,
        location: true
      }
    });
    
    // Filter products that need alerts
    const productsWithAlerts = allProducts.filter(product => {
      // Convert stockLevel to number (handle null/undefined)
      const stockLevel = product.stockLevel !== null && product.stockLevel !== undefined 
        ? Number(product.stockLevel) 
        : 0;
      
      // Get reorder point (default to 10 if not set)
      const reorderPoint = product.reorderPoint !== null && product.reorderPoint !== undefined
        ? Number(product.reorderPoint)
        : 10;
      
      // Show alert if:
      // 1. Out of stock (stockLevel = 0 or null/undefined)
      // 2. Stock level is at or below reorder point
      return stockLevel === 0 || stockLevel <= reorderPoint;
    });
    
    console.log(`Found ${allProducts.length} products, ${productsWithAlerts.length} need alerts`);
    
    // Format alerts - sort by priority (out of stock first, then low stock)
    const alerts = productsWithAlerts
      .map(product => {
        // Convert stockLevel to number (handle null/undefined)
        const stockLevel = product.stockLevel !== null && product.stockLevel !== undefined 
          ? Number(product.stockLevel) 
          : 0;
        
        // Get reorder point (default to 10 if not set)
        const reorderPoint = product.reorderPoint !== null && product.reorderPoint !== undefined
          ? Number(product.reorderPoint)
          : 10;
        
        let type, message, priority;
        
        if (stockLevel === 0) {
          type = 'out_of_stock';
          message = `${product.name} is out of stock`;
          priority = 1; // Highest priority
        } else if (stockLevel <= reorderPoint) {
          type = 'low_stock';
          message = `${product.name} stock level (${stockLevel}) is at or below reorder point (${reorderPoint})`;
          priority = 2; // Second priority
        } else {
          // This shouldn't happen due to our filter, but handle it just in case
          type = 'warning';
          message = `${product.name} stock is running low`;
          priority = 3;
        }
        
        return {
          id: product.id,
          type,
          product: product.name,
          message,
          currentStock: stockLevel,
          reorderPoint: reorderPoint,
          sku: product.sku || 'N/A',
          category: product.category || 'Uncategorized',
          location: product.location || 'Default Location',
          priority
        };
      })
      .sort((a, b) => {
        // Sort by priority first (out of stock first)
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        // Then sort by stock level (lowest first)
        return a.currentStock - b.currentStock;
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