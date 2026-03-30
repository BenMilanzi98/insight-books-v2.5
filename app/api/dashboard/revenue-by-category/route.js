// Optional analytics: revenue by inventory category + simple forecast multiplier (not required for core workflows)
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const forecastGrowthPct = Math.min(
      100,
      Math.max(-50, parseFloat(searchParams.get('forecastGrowthPct') || '0') || 0)
    );

    const whereSale = {
      tenantId: user.tenantId,
      status: 'completed',
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(`${endDate}T23:59:59.999Z`),
            },
          }
        : {}),
    };

    const sales = await prisma.sale.findMany({
      where: whereSale,
      select: {
        id: true,
        total: true,
        items: {
          select: {
            lineTotal: true,
            product: {
              select: {
                category: true,
                inventoryCategory: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const byCategory = new Map();
    for (const sale of sales) {
      for (const line of sale.items || []) {
        const cat =
          line.product?.inventoryCategory?.name ||
          line.product?.category ||
          'Uncategorized';
        const amt = Number(line.lineTotal ?? 0);
        byCategory.set(cat, (byCategory.get(cat) || 0) + amt);
      }
    }

    const rows = Array.from(byCategory.entries())
      .map(([category, actualRevenue]) => {
        const growth = 1 + forecastGrowthPct / 100;
        return {
          category,
          actualRevenue: Math.round(actualRevenue * 100) / 100,
          forecastRevenue:
            forecastGrowthPct !== 0
              ? Math.round(actualRevenue * growth * 100) / 100
              : null,
        };
      })
      .sort((a, b) => b.actualRevenue - a.actualRevenue);

    return NextResponse.json({
      success: true,
      optional: true,
      forecastGrowthPct,
      period: { startDate, endDate },
      categories: rows,
      totalActual: rows.reduce((s, r) => s + r.actualRevenue, 0),
    });
  } catch (error) {
    console.error('revenue-by-category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load revenue by category' },
      { status: 500 }
    );
  }
}
