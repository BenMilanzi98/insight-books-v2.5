import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';

import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';

import { addMoney } from '@/lib/money';

import {

  buildInventoryLossReconciliation,

  getGlPeriodTotals,

} from '@/lib/reportingEngine/index.js';

import {

  bootstrapReportRoute,

  auditReportAccess,

  enrichRowsWithTenantName,

  tenantNameMap,

} from '@/lib/reportRouteBootstrap';

import { enrichInventoryLossReport } from '@/lib/accountingReportService';

function getEventTypeFromReference(originalReference = '') {

  if (originalReference.startsWith('inventory-writeoff:')) return 'write_off';

  if (originalReference.startsWith('inventory-stockout:')) return 'stock_out';

  return 'unknown';

}



function getSourceIdFromReference(originalReference = '') {

  const idx = originalReference.indexOf(':');

  if (idx < 0) return null;

  return originalReference.slice(idx + 1) || null;

}



async function fetchMergedGlPeriodTotals(tenantIds, params) {

  let merged = null;

  for (const tenantId of tenantIds) {

    const t = await getGlPeriodTotals({ tenantId, ...params });

    if (!merged) {

      merged = { ...t, accountLines: [...(t.accountLines || [])] };

    } else {

      merged.revenue = addMoney(merged.revenue, t.revenue);

      merged.cogs = addMoney(merged.cogs, t.cogs);

      merged.operatingExpenses = addMoney(merged.operatingExpenses, t.operatingExpenses);

      merged.totalExpenses = addMoney(merged.totalExpenses, t.totalExpenses);

      merged.inventoryAssetMovement = addMoney(merged.inventoryAssetMovement, t.inventoryAssetMovement);

      merged.inventoryLoss = addMoney(merged.inventoryLoss, t.inventoryLoss);

      merged.hasGlActivity = merged.hasGlActivity || t.hasGlActivity;

      if (t.accountLines?.length) merged.accountLines.push(...t.accountLines);

    }

  }

  return merged;

}



export async function GET(request) {

  try {

    const boot = await bootstrapReportRoute(request);

    if (boot.error) return boot.error;

    const { user, userQ, tw, scope, tenantIds, tenants, reportBranchId, primaryTenantId } = boot;



    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');

    const endDate = searchParams.get('endDate');

    const eventType = (searchParams.get('eventType') || 'all').toLowerCase();



    if (!startDate || !endDate) {

      return NextResponse.json(

        { error: 'Start date and end date are required' },

        { status: 400 }

      );

    }



    const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {

      return NextResponse.json(

        { error: 'Invalid date format. Use YYYY-MM-DD.' },

        { status: 400 }

      );

    }

    if (start > end) {

      return NextResponse.json(

        { error: 'Start date cannot be after end date.' },

        { status: 400 }

      );

    }



    const allowedTypes = new Set(['all', 'write_off', 'stock_out']);

    if (!allowedTypes.has(eventType)) {

      return NextResponse.json(

        { error: 'Invalid eventType. Use all, write_off, or stock_out.' },

        { status: 400 }

      );

    }



    const whereBase = addBranchFilterIncludeUnassigned(userQ, {

      ...tw,

      status: 'Approved',

      isDeleted: false,

      isReversal: false,

      date: {

        gte: start,

        lte: end,

      },

      OR: [

        { originalReference: { startsWith: 'inventory-writeoff:' } },

        { originalReference: { startsWith: 'inventory-stockout:' } },

      ],

    });



    const expenses = await prisma.expense.findMany({

      where: whereBase,

      select: {

        id: true,

        tenantId: true,

        description: true,

        amount: true,

        date: true,

        originalReference: true,

        createdAt: true,

        notes: true,

        category: true,

        branch: {

          select: { id: true, name: true },

        },

        submittedBy: {

          select: { id: true, name: true },

        },

      },

      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],

    });



    const tMap = tenantNameMap(tenants);

    const multiTenant = tenantIds.length > 1;



    let items = expenses

      .map((expense) => {

        const derivedType = getEventTypeFromReference(expense.originalReference || '');

        return {

          id: expense.id,

          tenantId: expense.tenantId,

          ...(multiTenant ? { businessName: tMap.get(expense.tenantId) || expense.tenantId } : {}),

          date: expense.date,

          eventType: derivedType,

          sourceId: getSourceIdFromReference(expense.originalReference || ''),

          reference: expense.originalReference || null,

          description: expense.description || 'Inventory adjustment loss',

          amount: Number(expense.amount || 0),

          category: expense.category || 'Inventory Adjustment Loss',

          branchName: expense.branch?.name || 'Unassigned',

          branchId: expense.branch?.id || null,

          submittedBy: expense.submittedBy?.name || 'Unknown',

          notes: expense.notes || null,

        };

      })

      .filter((item) => (eventType === 'all' ? true : item.eventType === eventType));



    const sourceIds = [...new Set(items.map((i) => i.sourceId).filter(Boolean))];

    const batchLabels = new Map();

    if (sourceIds.length) {

      const batches = await prisma.inventoryBatch.findMany({

        where: { ...tw, id: { in: sourceIds } },

        select: {

          id: true,

          purchaseDate: true,

          expiryDate: true,

          product: { select: { name: true, sku: true } },

        },

      });

      for (const b of batches) {

        const productLabel = b.product?.name || b.product?.sku || 'Product';

        const dateHint = b.expiryDate

          ? `exp. ${new Date(b.expiryDate).toLocaleDateString()}`

          : b.purchaseDate

            ? `received ${new Date(b.purchaseDate).toLocaleDateString()}`

            : '';

        batchLabels.set(b.id, dateHint ? `${productLabel} (${dateHint})` : productLabel);

      }

      const missingIds = sourceIds.filter((id) => !batchLabels.has(id));

      if (missingIds.length) {

        const products = await prisma.product.findMany({

          where: { ...tw, id: { in: missingIds }, isDeleted: false },

          select: { id: true, name: true, sku: true },

        });

        for (const p of products) {

          batchLabels.set(p.id, p.name || p.sku || 'Product');

        }

      }

    }



    for (const item of items) {

      item.sourceLabel = item.sourceId

        ? batchLabels.get(item.sourceId) || 'Inventory adjustment'

        : 'Inventory adjustment';

    }



    items = enrichRowsWithTenantName(items, tMap);



    const summary = items.reduce(

      (acc, item) => {

        const amount = Number(item.amount || 0);

        acc.totalAmount += amount;

        acc.totalCount += 1;

        if (item.eventType === 'write_off') {

          acc.writeOffAmount += amount;

          acc.writeOffCount += 1;

        } else if (item.eventType === 'stock_out') {

          acc.stockOutAmount += amount;

          acc.stockOutCount += 1;

        }

        return acc;

      },

      {

        totalAmount: 0,

        totalCount: 0,

        writeOffAmount: 0,

        writeOffCount: 0,

        stockOutAmount: 0,

        stockOutCount: 0,

      }

    );



    const byMonthMap = new Map();

    for (const item of items) {

      const key = new Date(item.date).toISOString().slice(0, 7);

      if (!byMonthMap.has(key)) {

        byMonthMap.set(key, { month: key, writeOffAmount: 0, stockOutAmount: 0, totalAmount: 0, count: 0 });

      }

      const row = byMonthMap.get(key);

      row.totalAmount += item.amount;

      row.count += 1;

      if (item.eventType === 'write_off') row.writeOffAmount += item.amount;

      if (item.eventType === 'stock_out') row.stockOutAmount += item.amount;

    }



    let glTotals = null;

    try {

      glTotals = await fetchMergedGlPeriodTotals(tenantIds, {

        startDate,

        endDate,

        branchId: reportBranchId,

        prisma,

      });

    } catch (glErr) {

      console.warn('Inventory loss report: GL reconciliation failed', glErr?.message || glErr);

    }



    await auditReportAccess({

      user,

      reportType: 'inventory-losses',

      tenantIds,

      scope,

      filters: { startDate, endDate, eventType },

    });



    const basePayload = {
      period: { startDate, endDate },
      filters: { eventType },
      summary,
      byMonth: Array.from(byMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      items,
      metadata: {
        ledgerSource: 'general_ledger',
        fromGeneralLedger: Boolean(glTotals?.hasGlActivity),
        glInventoryLossTotal: glTotals?.inventoryLoss ?? 0,
        glInventoryAssetMovement: glTotals?.inventoryAssetMovement ?? 0,
        reconciliation: glTotals
          ? buildInventoryLossReconciliation(summary.totalAmount, glTotals)
          : null,
      },
      scope,
    };

    const enriched = await enrichInventoryLossReport(basePayload, {
      tenantId: tenantIds.length === 1 ? primaryTenantId : tenantIds[0],
      startDate,
      endDate,
      branchId: reportBranchId,
    });

    return NextResponse.json(enriched);

  } catch (error) {

    console.error('Error generating inventory loss report:', error);

    return NextResponse.json(

      { error: 'Failed to generate inventory loss report. Please try again.' },

      { status: 500 }

    );

  }

}

