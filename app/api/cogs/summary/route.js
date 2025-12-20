// app/api/cogs/summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getCOGSSummary, validateCOGSSetup } from '@/lib/cogsIntegration';

/**
 * GET - Get COGS summary and validation
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

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const action = searchParams.get('action');

    // Validate COGS setup
    if (action === 'validate') {
      const validation = await validateCOGSSetup(user.tenantId);
      return NextResponse.json(validation);
    }

    // Default to current month if no dates provided
    const now = new Date();
    const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const summaryStartDate = startDate ? new Date(startDate) : defaultStartDate;
    const summaryEndDate = endDate ? new Date(endDate) : defaultEndDate;

    // Get COGS summary
    const summary = await getCOGSSummary(user.tenantId, summaryStartDate, summaryEndDate);

    // Get meaningful business metrics instead of confusing accounting balances
    const [
      totalInventoryValue,
      totalCOGSThisMonth,
      totalRevenueThisMonth,
      productsWithStock
    ] = await Promise.all([
      // Calculate total inventory value (sum of all products * their cost * stock level)
      prisma.product.aggregate({
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
          stockLevel: { gt: 0 }
        },
        _sum: {
          cost: true
        }
      }).then(result => {
        // Get actual inventory value by multiplying cost * stock for each product
        return prisma.product.findMany({
          where: {
            tenantId: user.tenantId,
            isDeleted: false,
            stockLevel: { gt: 0 }
          },
          select: {
            cost: true,
            stockLevel: true
          }
        }).then(products => {
          return products.reduce((sum, product) => {
            return sum + ((product.cost || 0) * (product.stockLevel || 0));
          }, 0);
        });
      }),

      // Get total COGS for this month from completed sales
      prisma.saleItem.aggregate({
        where: {
          sale: {
            tenantId: user.tenantId,
            status: 'completed',
            saleDate: {
              gte: summaryStartDate,
              lte: summaryEndDate
            }
          },
          product: {
            isNot: null
          }
        },
        _sum: {
          quantity: true
        }
      }).then(async (result) => {
        // Calculate actual COGS by getting products and their costs
        const saleItems = await prisma.saleItem.findMany({
          where: {
            sale: {
              tenantId: user.tenantId,
              status: 'completed',
              saleDate: {
                gte: summaryStartDate,
                lte: summaryEndDate
              }
            },
            product: {
              isNot: null
            }
          },
          include: {
            product: {
              select: {
                cost: true
              }
            }
          }
        });

        return saleItems.reduce((sum, item) => {
          return sum + (item.quantity * (item.product?.cost || 0));
        }, 0);
      }),

      // Get total revenue for this month
      prisma.sale.aggregate({
        where: {
          tenantId: user.tenantId,
          status: 'completed',
          saleDate: {
            gte: summaryStartDate,
            lte: summaryEndDate
          }
        },
        _sum: {
          total: true
        }
      }).then(result => result._sum.total || 0),

      // Count products with stock
      prisma.product.count({
        where: {
          tenantId: user.tenantId,
          isDeleted: false,
          stockLevel: { gt: 0 }
        }
      })
    ]);

    return NextResponse.json({
      summary: {
        ...summary,
        totalCOGS: totalCOGSThisMonth,
        transactionCount: summary.transactionCount || 0
      },
      accounts: {
        inventory: {
          name: 'Current Inventory Value',
          balance: totalInventoryValue
        },
        cogs: {
          name: 'COGS This Month',
          balance: totalCOGSThisMonth
        },
        accountsPayable: {
          name: 'Revenue This Month',
          balance: totalRevenueThisMonth
        }
      },
      businessMetrics: {
        totalInventoryValue,
        totalCOGSThisMonth,
        totalRevenueThisMonth,
        productsWithStock,
        grossProfit: totalRevenueThisMonth - totalCOGSThisMonth,
        profitMargin: totalRevenueThisMonth > 0 ? ((totalRevenueThisMonth - totalCOGSThisMonth) / totalRevenueThisMonth * 100) : 0
      },
      period: {
        startDate: summaryStartDate,
        endDate: summaryEndDate
      }
    });

  } catch (error) {
    console.error('Error fetching COGS summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch COGS summary' },
      { status: 500 }
    );
  }
}

