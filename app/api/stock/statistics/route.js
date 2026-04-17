// app/api/inventory/statistics/route.js - Updated to exclude soft-deleted products
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { resolveProductCostPriceForDisplay } from '@/lib/productCostDisplay';

// GET - Fetch inventory statistics with fallbacks
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
   
    // Physical inventory only (exclude billable services from stock metrics)
    let whereClause = { tenantId: user.tenantId, isService: false };
    
    // Add branch filtering - Product model uses branch relation, not branchId
    if (user?.currentBranchId) {
      whereClause.branchId = user.currentBranchId;
    }
    
    // Check if isDeleted field exists by trying to query with it
    try {
      await prisma.product.findFirst({
        where: { ...whereClause, isDeleted: false },
        select: { id: true }
      });
      // If no error, the field exists, so use it
      whereClause.isDeleted = false;
    } catch (fieldError) {
      // Field doesn't exist yet, continue without it
      console.log('isDeleted field not found, using all products');
    }
    
    const totalItems = await prisma.product.count({
      where: whereClause
    });

    let serviceCount = 0;
    try {
      const serviceCountWhere = {
        tenantId: user.tenantId,
        isService: true,
        ...(whereClause.branchId ? { branchId: whereClause.branchId } : {}),
      };
      if (whereClause.isDeleted === false) {
        serviceCountWhere.isDeleted = false;
      }
      serviceCount = await prisma.product.count({ where: serviceCountWhere });
    } catch (_) {
      serviceCount = 0;
    }
   
    // Get all active products with correct field names
    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        stockLevel: true,
        cost: true,
        averageCost: true,
        lastPurchaseCost: true,
        totalStockValue: true,
        reorderPoint: true
      }
    });
   
    // Calculate inventory statistics
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;
   
    products.forEach(product => {
      // Calculate inventory value: use totalStockValue only when set and > 0, else cost × stock
      // so that adding cost later or never-synced totalStockValue still shows correct value
      const stockLevel = Number(product.stockLevel) || 0;
      const cost = resolveProductCostPriceForDisplay(product);
      const stored = product.totalStockValue != null ? Number(product.totalStockValue) : null;
      const productValue = (stored != null && stored > 0) ? stored : (stockLevel * cost);
      totalValue += productValue;
     
      // Count low stock and out of stock items
      // Use the same logic as stock alerts API
      const reorderPoint = product.reorderPoint || 10; // Default to 10 if not set
      
      if (stockLevel === 0) {
        outOfStock++;
      } else if (stockLevel <= reorderPoint) {
        lowStock++;
      }
    });
   
    // Check if the InventoryTransaction model exists - it doesn't, so use mock data
    const recentTransactions = [];
    // Since we don't have transactions yet, let's provide empty mock data
    
    // Calculate nearing reorder stats using correct field names
    const nearingReorder = products.filter(product => {
      const stockLevel = product.stockLevel || 0;
      const reorderPoint = product.reorderPoint || 10; // Use actual reorder point from database
      return stockLevel > 0 && stockLevel <= reorderPoint * 1.2;
    }).length;
   
    // Mock categories since the category field doesn't exist yet
    const categoryPercentages = [
      {
        name: 'Uncategorized',
        count: totalItems,
        percentage: 100
      }
    ];
   
    // Return statistics with fallbacks
    return NextResponse.json({
      totalItems,
      serviceCount,
      totalValue: totalValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      lowStock,
      outOfStock,
      nearingReorder,
      categories: categoryPercentages,
      recentTransactions
    });
  } catch (error) {
    console.error('Error fetching inventory statistics:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch inventory statistics. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}