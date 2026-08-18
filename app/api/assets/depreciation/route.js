// app/api/assets/depreciation/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  calcDepreciationAmount,
  rangeForPreset,
} from '@/lib/assets/depreciationPeriods.js';

async function postDepreciationGl({
  user,
  asset,
  depreciationSchedule,
  depreciationAmount,
  startDate,
  endDate,
  frequency,
}) {
  if (depreciationAmount <= 0.01) return null;
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
    const periodLabel = frequency && frequency !== 'custom' ? ` (${frequency})` : '';
    const lines = [
      {
        lineNumber: 1,
        accountId: expenseAcct.id,
        debitAmount: amt,
        creditAmount: 0,
        description: `Depreciation — ${asset.name}${periodLabel}`,
      },
      {
        lineNumber: 2,
        accountId: accumAcct.id,
        debitAmount: 0,
        creditAmount: amt,
        description: `Accumulated depreciation — ${asset.name}${periodLabel}`,
      },
    ];
    const desc = `Depreciation ${asset.name}${periodLabel} (${startDate.toISOString().slice(0, 10)}–${endDate.toISOString().slice(0, 10)})`;
    return (
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
    return null;
  }
}

async function depreciateOneAsset({ user, asset, startDate, endDate, frequency, periodCount }) {
  const depreciationAmount = calcDepreciationAmount(asset, {
    frequency,
    periodCount,
    startDate,
    endDate,
  });
  const newAccumulatedDepreciation = (asset.accumulatedDepreciation || 0) + depreciationAmount;
  const remainingValue = asset.originalCost - newAccumulatedDepreciation;

  const depreciationSchedule = await prisma.depreciationSchedule.create({
    data: {
      assetId: asset.id,
      periodStart: startDate,
      periodEnd: endDate,
      depreciationAmount,
      remainingValue,
      tenantId: user.tenantId,
    },
  });

  const updatedAsset = await prisma.asset.update({
    where: { id: asset.id },
    data: { accumulatedDepreciation: newAccumulatedDepreciation },
  });

  const glResult = await postDepreciationGl({
    user,
    asset,
    depreciationSchedule,
    depreciationAmount,
    startDate,
    endDate,
    frequency,
  });

  return {
    assetId: asset.id,
    periodStart: startDate,
    periodEnd: endDate,
    frequency: frequency || 'custom',
    periodCount: periodCount || 1,
    depreciationAmount,
    accumulatedDepreciation: newAccumulatedDepreciation,
    remainingValue,
    depreciationSchedule,
    journalEntryId: glResult?.journalEntryId || glResult?.id || null,
    asset: updatedAsset,
  };
}

/**
 * POST — calculate depreciation for one asset or all active assets.
 * Body: { periodStart, periodEnd, assetId? } or { periodStart, periodEnd, assetIds?: string[] }
 * Empty assetIds / omitted assetId → all ACTIVE assets for the tenant.
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      assetId,
      assetIds,
      periodStart,
      periodEnd,
      frequency = 'custom',
      periodCount = 1,
    } = body;

    let startDate;
    let endDate;
    const freq = String(frequency || 'custom').toLowerCase();
    const count = Math.max(1, Number(periodCount) || 1);

    if (freq !== 'custom' && ['hour', 'day', 'week', 'month', 'quarter', 'year'].includes(freq)) {
      const range = rangeForPreset(freq, count, periodEnd ? new Date(periodEnd) : new Date());
      startDate = range.periodStart;
      endDate = range.periodEnd;
      // Prefer explicit dates when provided (UI sets them from preset)
      if (periodStart && periodEnd) {
        const ps = new Date(periodStart);
        const pe = new Date(periodEnd);
        if (!Number.isNaN(ps.getTime()) && !Number.isNaN(pe.getTime()) && pe >= ps) {
          startDate = ps;
          endDate = pe;
        }
      }
    } else {
      if (!periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'Missing required fields: periodStart, periodEnd' },
          { status: 400 }
        );
      }
      startDate = new Date(periodStart);
      endDate = new Date(periodEnd);
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid periodStart or periodEnd' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'periodEnd must be on or after periodStart' },
        { status: 400 }
      );
    }

    let targetIds = [];
    if (assetId) {
      targetIds = [assetId];
    } else if (Array.isArray(assetIds) && assetIds.length > 0) {
      targetIds = assetIds;
    }

    const assets = await prisma.asset.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetIds.length
          ? { id: { in: targetIds } }
          : {
              OR: [
                { status: 'active' },
                { status: 'ACTIVE' },
                { status: 'Active' },
              ],
            }),
      },
    });

    let list = assets;
    if (!targetIds.length && list.length === 0) {
      list = await prisma.asset.findMany({
        where: {
          tenantId: user.tenantId,
          NOT: {
            OR: [
              { status: 'disposed' },
              { status: 'DISPOSED' },
              { status: 'Disposed' },
              { status: 'sold' },
              { status: 'SOLD' },
            ],
          },
        },
      });
    }

    if (targetIds.length && list.length === 0) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    if (!list.length) {
      return NextResponse.json(
        { error: 'No active assets found to depreciate' },
        { status: 404 }
      );
    }

    const results = [];
    let totalDepreciation = 0;
    for (const asset of list) {
      const row = await depreciateOneAsset({
        user,
        asset,
        startDate,
        endDate,
        frequency: freq,
        periodCount: count,
      });
      results.push(row);
      totalDepreciation += row.depreciationAmount || 0;
    }

    // Single-asset response shape (back-compat) + bulk summary for the UI modal
    if (results.length === 1 && assetId) {
      return NextResponse.json({
        message: 'Depreciation calculated successfully',
        depreciation: results[0],
        asset: results[0].asset,
        summary: {
          assetsProcessed: 1,
          totalDepreciation,
          frequency: freq,
          periodCount: count,
        },
      });
    }

    return NextResponse.json({
      message: 'Depreciation calculated successfully',
      depreciations: results,
      summary: {
        assetsProcessed: results.length,
        totalDepreciation,
        periodStart: startDate,
        periodEnd: endDate,
        frequency: freq,
        periodCount: count,
      },
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
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ error: 'Asset ID is required' }, { status: 400 });
    }

    const schedules = await prisma.depreciationSchedule.findMany({
      where: {
        assetId,
        tenantId: user.tenantId,
      },
      orderBy: {
        periodStart: 'desc',
      },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching depreciation schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch depreciation schedules', details: error.message },
      { status: 500 }
    );
  }
}
