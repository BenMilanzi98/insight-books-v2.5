// app/api/assets/report/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * GET handler for asset reports
 * Generates various asset reports
 */
export async function GET(request) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'summary';
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let where = {
      tenantId: user.tenantId
    };

    // Apply filters
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (startDate && endDate) {
      where.purchaseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch assets with related data
    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        depreciationSchedules: {
          orderBy: {
            periodStart: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    });

    // Calculate summary statistics
    const totalAssets = assets.length;
    const totalOriginalCost = assets.reduce((sum, asset) => sum + asset.originalCost, 0);
    const totalAccumulatedDepreciation = assets.reduce((sum, asset) => sum + (asset.accumulatedDepreciation || 0), 0);
    const totalNetBookValue = totalOriginalCost - totalAccumulatedDepreciation;

    // Group by category
    const categorySummary = assets.reduce((acc, asset) => {
      const categoryName = asset.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = {
          count: 0,
          totalCost: 0,
          totalDepreciation: 0,
          netValue: 0
        };
      }
      acc[categoryName].count += 1;
      acc[categoryName].totalCost += asset.originalCost;
      acc[categoryName].totalDepreciation += asset.accumulatedDepreciation || 0;
      acc[categoryName].netValue += asset.originalCost - (asset.accumulatedDepreciation || 0);
      return acc;
    }, {});

    // Group by status
    const statusSummary = assets.reduce((acc, asset) => {
      if (!acc[asset.status]) {
        acc[asset.status] = {
          count: 0,
          totalCost: 0,
          totalDepreciation: 0,
          netValue: 0
        };
      }
      acc[asset.status].count += 1;
      acc[asset.status].totalCost += asset.originalCost;
      acc[asset.status].totalDepreciation += asset.accumulatedDepreciation || 0;
      acc[asset.status].netValue += asset.originalCost - (asset.accumulatedDepreciation || 0);
      return acc;
    }, {});

    // Format assets for detailed report
    const formattedAssets = assets.map(asset => {
      const latestDepreciation = asset.depreciationSchedules[0];
      const currentAccumulatedDepreciation = latestDepreciation?.accumulatedDepreciation || asset.accumulatedDepreciation || 0;
      const currentNetBookValue = asset.originalCost - currentAccumulatedDepreciation;

      return {
        ...asset,
        currentAccumulatedDepreciation,
        currentNetBookValue,
        depreciationPercentage: asset.originalCost > 0 ? (currentAccumulatedDepreciation / asset.originalCost) * 100 : 0
      };
    });

    // Generate report based on type
    let reportData = {};

    switch (reportType) {
      case 'summary':
        reportData = {
          summary: {
            totalAssets,
            totalOriginalCost,
            totalAccumulatedDepreciation,
            totalNetBookValue,
            averageAssetValue: totalAssets > 0 ? totalOriginalCost / totalAssets : 0
          },
          categorySummary,
          statusSummary
        };
        break;

      case 'detailed':
        reportData = {
          assets: formattedAssets,
          summary: {
            totalAssets,
            totalOriginalCost,
            totalAccumulatedDepreciation,
            totalNetBookValue
          }
        };
        break;

      case 'depreciation':
        reportData = {
          assets: formattedAssets.filter(asset => asset.currentAccumulatedDepreciation > 0),
          summary: {
            totalAssets: formattedAssets.filter(asset => asset.currentAccumulatedDepreciation > 0).length,
            totalAccumulatedDepreciation,
            averageDepreciationPercentage: totalOriginalCost > 0 ? (totalAccumulatedDepreciation / totalOriginalCost) * 100 : 0
          }
        };
        break;

      default:
        reportData = {
          summary: {
            totalAssets,
            totalOriginalCost,
            totalAccumulatedDepreciation,
            totalNetBookValue
          },
          assets: formattedAssets
        };
    }

    return NextResponse.json({
      reportType,
      generatedAt: new Date().toISOString(),
      filters: {
        categoryId,
        status,
        startDate,
        endDate
      },
      data: reportData
    });

  } catch (error) {
    console.error('Error generating asset report:', error);
    return NextResponse.json(
      { error: 'Failed to generate asset report', details: error.message },
      { status: 500 }
    );
  }
}