import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import {
  calculateDateRange,
  formatYmdInTimeZone,
  parseInclusiveApiYmdRange,
} from '@/lib/dateUtils';
import { getEffectiveDashboardBranchId, normalizeBranchId } from '@/lib/branchAccess';
import {
  invoiceItemNetRevenueExTax,
  saleItemNetRevenueExTax,
} from '@/lib/reportLineNetRevenue';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getDateRange(searchParams) {
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const timeframe = searchParams.get('timeframe') || searchParams.get('dateRange') || 'thisMonth';

  if (startParam && endParam) {
    const { start, end } = parseInclusiveApiYmdRange(startParam, endParam);
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid startDate or endDate');
    }
    if (start > end) throw new Error('Start date cannot be after end date');
    return { startDate: start, endDate: end };
  }

  const { startDate: rawStart, endDate: rawEnd } = calculateDateRange(timeframe);
  const startYmd = formatYmdInTimeZone(rawStart);
  const endYmd = formatYmdInTimeZone(rawEnd);
  const { start, end } = parseInclusiveApiYmdRange(startYmd, endYmd);
  return { startDate: start, endDate: end };
}

function unitCostFromProduct(product) {
  if (!product) return 0;
  const c = product.cost != null ? Number(product.cost) : NaN;
  if (Number.isFinite(c) && c >= 0) return c;
  const a = product.averageCost != null ? Number(product.averageCost) : NaN;
  if (Number.isFinite(a) && a >= 0) return a;
  return 0;
}

const DRAFT_STATUSES = ['draft', 'Draft', 'void', 'Void', 'cancelled', 'Cancelled'];

/**
 * GET /api/reports/product-profit-detail
 * Product-level sales (invoices + POS) in range with cost, profit, margin.
 * Query: startDate & endDate, or timeframe (same as financial-analytics).
 * Optional: categoryId — filter to products in that inventory category.
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, userQ, tw, scope, tenantIds, reportBranchId } = boot;

    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = getDateRange(searchParams);
    const categoryIdFilter = (searchParams.get('categoryId') || '').trim();

    const accessEff = getEffectiveDashboardBranchId(userQ);
    const branchId =
      accessEff === false ? null : normalizeBranchId(userQ.currentBranchId) ?? reportBranchId ?? null;

    const productSelect = {
      id: true,
      name: true,
      sku: true,
      cost: true,
      averageCost: true,
      isService: true,
      categoryId: true,
      tenantId: true,
      inventoryCategory: { select: { id: true, name: true } },
    };

    const invoiceWhere = {
      ...tw,
      voidedAt: null,
      refundedAt: null,
      isReversal: false,
      issueDate: { gte: startDate, lte: endDate },
      status: { notIn: DRAFT_STATUSES },
      ...(branchId ? { branchId } : {}),
    };

    const invoiceItems =
      accessEff === false
        ? []
        : await prisma.invoiceItem.findMany({
            where: {
              invoice: { is: invoiceWhere },
              ...(categoryIdFilter
                ? { product: { is: { categoryId: categoryIdFilter, ...tw } } }
                : {}),
            },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              amount: true,
              discountAmount: true,
              netAmount: true,
              productId: true,
              product: { select: productSelect },
              invoice: {
                select: { invoiceNumber: true, issueDate: true, status: true, tenantId: true },
              },
            },
          });

    const saleWhere = {
      ...tw,
      status: 'completed',
      voidedAt: null,
      refundedAt: null,
      isReversal: false,
      saleDate: { gte: startDate, lte: endDate },
      ...(branchId ? { branchId } : {}),
    };

    const saleItems =
      accessEff === false
        ? []
        : await prisma.saleItem.findMany({
            where: {
              sale: { is: saleWhere },
              ...(categoryIdFilter
                ? { product: { is: { categoryId: categoryIdFilter, ...tw } } }
                : {}),
            },
            select: {
              id: true,
              description: true,
              quantity: true,
              unitPrice: true,
              amount: true,
              discountAmount: true,
              productId: true,
              isCustom: true,
              product: { select: productSelect },
              sale: { select: { saleNumber: true, saleDate: true, tenantId: true } },
            },
          });

    const expenseAgg = await prisma.expense.aggregate({
      where: addBranchFilter(userQ, {
        ...tw,
        status: 'Approved',
        isDeleted: false,
        isReversal: false,
        date: { gte: startDate, lte: endDate },
      }),
      _sum: { amount: true },
    });
    const operatingExpensesApproved = round2(expenseAgg._sum.amount || 0);

    /** @type {Map<string, { key: string, productId: string|null, name: string, sku: string|null, categoryName: string, qtyInv: number, qtyPos: number, revenue: number, cost: number }>} */
    const byKey = new Map();

    const rowKey = (productId, description, isCustom) => {
      if (productId) return `p:${productId}`;
      const d = (description || 'Custom line').trim() || 'Custom line';
      return `c:${isCustom ? 'cust' : 'misc'}:${d}`;
    };

    const bump = (key, base, qtyDelta, revDelta, costDelta) => {
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          productId: base.productId,
          name: base.name,
          sku: base.sku,
          categoryName: base.categoryName,
          qtyInv: 0,
          qtyPos: 0,
          revenue: 0,
          cost: 0,
        });
      }
      const r = byKey.get(key);
      r.revenue = round2(r.revenue + revDelta);
      r.cost = round2(r.cost + costDelta);
      if (qtyDelta.inv) r.qtyInv = round2(r.qtyInv + qtyDelta.inv);
      if (qtyDelta.pos) r.qtyPos = round2(r.qtyPos + qtyDelta.pos);
    };

    for (const it of invoiceItems) {
      const qty = Number(it.quantity) || 0;
      const rev = invoiceItemNetRevenueExTax(it);
      const p = it.product;
      const uc = unitCostFromProduct(p);
      const cost = round2(qty * uc);
      const name = p?.name || it.description || 'Line item';
      const sku = p?.sku ?? null;
      const categoryName =
        p?.inventoryCategory?.name || p?.categoryId || 'Uncategorized';
      const key = rowKey(it.productId, it.description, false);
      bump(
        key,
        {
          productId: it.productId,
          name,
          sku,
          categoryName: typeof categoryName === 'string' ? categoryName : 'Uncategorized',
        },
        { inv: qty, pos: 0 },
        rev,
        cost,
      );
    }

    for (const it of saleItems) {
      const qty = Number(it.quantity) || 0;
      const rev = saleItemNetRevenueExTax(it);
      const p = it.product;
      const uc = unitCostFromProduct(p);
      const cost = round2(qty * uc);
      const name = p?.name || it.description || (it.isCustom ? 'POS custom' : 'Line item');
      const sku = p?.sku ?? null;
      const categoryName = p?.inventoryCategory?.name || p?.categoryId || 'Uncategorized';
      const key = rowKey(it.productId, it.description, it.isCustom);
      bump(
        key,
        {
          productId: it.productId,
          name,
          sku,
          categoryName: typeof categoryName === 'string' ? categoryName : 'Uncategorized',
        },
        { inv: 0, pos: qty },
        rev,
        cost,
      );
    }

    const rows = Array.from(byKey.values())
      .map((r) => {
        const qty = round2(r.qtyInv + r.qtyPos);
        const profit = round2(r.revenue - r.cost);
        const marginPercent =
          r.revenue > 0.0001 ? round2((profit / r.revenue) * 100) : null;
        const avgSell = qty > 0 ? round2(r.revenue / qty) : 0;
        const avgCost = qty > 0 ? round2(r.cost / qty) : 0;
        return {
          productId: r.productId,
          name: r.name,
          sku: r.sku,
          categoryName: r.categoryName,
          quantity: qty,
          quantityFromInvoices: r.qtyInv,
          quantityFromPos: r.qtyPos,
          avgSellingPrice: avgSell,
          avgCostPrice: avgCost,
          revenue: r.revenue,
          cost: r.cost,
          profit,
          marginPercent,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    let productSalesRevenue = 0;
    let productCostTotal = 0;
    for (const r of rows) {
      productSalesRevenue += r.revenue;
      productCostTotal += r.cost;
    }
    productSalesRevenue = round2(productSalesRevenue);
    productCostTotal = round2(productCostTotal);
    const productGrossProfit = round2(productSalesRevenue - productCostTotal);
    const profitAfterOperating = round2(productGrossProfit - operatingExpensesApproved);

    await auditReportAccess({
      user,
      reportType: 'product-profit-detail',
      tenantIds,
      scope,
      filters: {
        startDate: formatYmdInTimeZone(startDate),
        endDate: formatYmdInTimeZone(endDate),
        categoryId: categoryIdFilter || null,
      },
    });

    return NextResponse.json({
      period: {
        startDate: formatYmdInTimeZone(startDate),
        endDate: formatYmdInTimeZone(endDate),
      },
      summary: {
        productSalesRevenue,
        productCostTotal,
        productGrossProfit,
        operatingExpensesApproved,
        profitAfterOperatingExpenses: profitAfterOperating,
        lineCountInvoices: invoiceItems.length,
        lineCountPos: saleItems.length,
        skuCount: rows.length,
      },
      rows,
      scope,
    });
  } catch (e) {
    console.error('product-profit-detail', e);
    const msg = e?.message === 'Invalid startDate or endDate' ? e.message : 'Failed to load product profit detail';
    return NextResponse.json(
      { error: msg },
      { status: e?.message?.includes('Invalid') ? 400 : 500 },
    );
  }
}
