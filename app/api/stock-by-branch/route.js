// app/api/stock-by-branch/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// GET - Get stock summary by branch
export async function GET(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get all active branches for the tenant
    const branches = await prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Get stock summary for each branch
    const branchStock = await Promise.all(
      branches.map(async (branch) => {
        // Get all products for this branch
        const products = await prisma.product.findMany({
          where: {
            tenantId: user.tenantId,
            branchId: branch.id,
            isDeleted: false
          },
          select: {
            id: true,
            stockLevel: true,
            cost: true,
            price: true
          }
        });

        // Calculate totals
        const productCount = products.length;
        const totalQuantity = products.reduce((sum, p) => {
          return sum + parseFloat(p.stockLevel || 0);
        }, 0);
        const totalValue = products.reduce((sum, p) => {
          const qty = parseFloat(p.stockLevel || 0);
          const cost = parseFloat(p.cost || 0);
          return sum + (qty * cost);
        }, 0);

        return {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          productCount,
          totalQuantity,
          totalValue: parseFloat(totalValue.toFixed(2)),
          products: products.map(p => ({
            id: p.id,
            stockLevel: parseFloat(p.stockLevel || 0),
            cost: parseFloat(p.cost || 0),
            price: parseFloat(p.price || 0)
          }))
        };
      })
    );

    return NextResponse.json({
      branches: branchStock
    });
  } catch (error) {
    console.error('Error fetching stock by branch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock by branch' },
      { status: 500 }
    );
  }
}

