// app/api/cogs/products/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * GET - Get products with their COGS and sales data
 */
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

    // Get all products for the tenant
    const products = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        isDeleted: false
      },
      include: {
        saleItems: {
          where: {
            sale: {
              status: 'completed'
            }
          },
          include: {
            sale: {
              select: {
                id: true,
                saleDate: true,
                status: true
              }
            }
          },
          orderBy: {
            sale: {
              saleDate: 'desc'
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Calculate COGS and sales statistics for each product
    const productsWithStats = products.map(product => {
      const saleItems = product.saleItems || [];
      const totalSales = saleItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = saleItems.reduce((sum, item) => sum + item.amount, 0);
      const totalCOGS = saleItems.reduce((sum, item) => sum + (item.quantity * (product.cost || 0)), 0);
      
      return {
        id: product.id,
        name: product.name,
        cost: product.cost || 0,
        price: product.price || 0,
        stockLevel: product.stockLevel || 0,
        totalSales,
        totalRevenue,
        totalCOGS,
        sales: saleItems.map(item => ({
          date: item.sale.saleDate,
          quantity: item.quantity,
          revenue: item.amount,
          cogs: item.quantity * (product.cost || 0)
        }))
      };
    });

    return NextResponse.json({
      products: productsWithStats,
      totalProducts: productsWithStats.length
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products data' },
      { status: 500 }
    );
  }
}
