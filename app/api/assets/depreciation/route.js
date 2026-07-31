// app/api/assets/depreciation/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * POST handler for calculating depreciation
 * Calculates depreciation for an asset
 */
export async function POST(request) {
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

    const body = await request.json();
    const { assetId, periodStart, periodEnd } = body;

    // Validate required fields
    if (!assetId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    // Get asset details
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        tenantId: user.tenantId
      }
    });

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Calculate depreciation based on method
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysInYear = 365;

    let depreciationAmount = 0;
    let remainingValue = asset.originalCost;

    if (asset.depreciationMethod === 'straight_line') {
      // Straight-line depreciation
      const annualDepreciation = asset.originalCost / (asset.usefulLifeYears || 1);
      depreciationAmount = (annualDepreciation * daysInPeriod) / daysInYear;
    } else if (asset.depreciationMethod === 'declining_balance') {
      // Declining balance depreciation
      const rate = 2 / (asset.usefulLifeYears || 1); // Double declining balance
      const currentValue = asset.originalCost - (asset.accumulatedDepreciation || 0);
      depreciationAmount = (currentValue * rate * daysInPeriod) / daysInYear;
    } else {
      // Default to straight-line
      const annualDepreciation = asset.originalCost / (asset.usefulLifeYears || 1);
      depreciationAmount = (annualDepreciation * daysInPeriod) / daysInYear;
    }

    // Calculate remaining value
    const newAccumulatedDepreciation = (asset.accumulatedDepreciation || 0) + depreciationAmount;
    remainingValue = asset.originalCost - newAccumulatedDepreciation;

    // Create depreciation schedule entry
    const depreciationSchedule = await prisma.depreciationSchedule.create({
      data: {
        assetId: assetId,
        periodStart: startDate,
        periodEnd: endDate,
        depreciationAmount: depreciationAmount,
        remainingValue: remainingValue,
        tenantId: user.tenantId
      }
    });

    // Update asset with new accumulated depreciation
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: {
        accumulatedDepreciation: newAccumulatedDepreciation
      }
    });

    // Stage 5 — post depreciation GL (was register-only)
    let glResult = null;
    if (depreciationAmount > 0.01) {
      try {
        const { resolvePurposeAccount } = await import(
          '@/lib/coaV2/application/accountMappingRegistry.js'
        );
        const { createAccountingContext } = await import(
          '@/lib/accountingV2/domain/accountingContext.js'
        );
        const { postDepreciationAccounting } = await import(
          '@/lib/accountingV2/adapters/remainingAdapters.js'
        );
        const { postGlEntry } = await import('@/lib/accountingEngine/postGlEntry.js');
        const ctx = createAccountingContext({
          businessId: user.tenantId,
          userId: user.id,
        });
        const expenseAcct = await resolvePurposeAccount(ctx, 'DEPRECIATION_EXPENSE');
        const accumAcct = await resolvePurposeAccount(ctx, 'ACCUMULATED_DEPRECIATION');
        const amt = Math.round(depreciationAmount * 100) / 100;
        const lines = [
          {
            lineNumber: 1,
            accountId: expenseAcct.id,
            debitAmount: amt,
            creditAmount: 0,
            description: `Depreciation — ${asset.name}`,
          },
          {
            lineNumber: 2,
            accountId: accumAcct.id,
            debitAmount: 0,
            creditAmount: amt,
            description: `Accumulated depreciation — ${asset.name}`,
          },
        ];
        const desc = `Depreciation ${asset.name} (${startDate.toISOString().slice(0, 10)}–${endDate.toISOString().slice(0, 10)})`;
        glResult = (
          await postDepreciationAccounting({
            db: prisma,
            tenantId: user.tenantId,
            userId: user.id,
            sourceId: depreciationSchedule.id,
            amount: amt,
            date: endDate,
            description: desc,
            lines,
            legacyPost: () =>
              postGlEntry({
                tenantId: user.tenantId,
                userId: user.id,
                entryDate: endDate,
                description: desc,
                sourceType: 'DepreciationSchedule',
                sourceId: depreciationSchedule.id,
                lines,
              }),
          })
        ).result;
      } catch (glErr) {
        console.error('Depreciation GL posting failed (schedule saved):', glErr?.message || glErr);
      }
    }

    return NextResponse.json({
      message: 'Depreciation calculated successfully',
      depreciation: {
        assetId: assetId,
        periodStart: startDate,
        periodEnd: endDate,
        depreciationAmount: depreciationAmount,
        accumulatedDepreciation: newAccumulatedDepreciation,
        remainingValue: remainingValue,
        depreciationSchedule: depreciationSchedule,
        journalEntryId: glResult?.journalEntryId || glResult?.id || null,
      },
      asset: updatedAsset
    });

  } catch (error) {
    console.error('Error calculating depreciation:', error);
    return NextResponse.json(
      { error: 'Failed to calculate depreciation', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET handler for depreciation schedules
 * Fetches depreciation schedules for an asset
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
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Fetch depreciation schedules
    const schedules = await prisma.depreciationSchedule.findMany({
      where: {
        assetId: assetId,
        tenantId: user.tenantId
      },
      orderBy: {
        periodStart: 'desc'
      }
    });

    return NextResponse.json({
      schedules: schedules
    });

  } catch (error) {
    console.error('Error fetching depreciation schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch depreciation schedules', details: error.message },
      { status: 500 }
    );
  }
}