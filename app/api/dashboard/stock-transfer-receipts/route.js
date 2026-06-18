import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
} from '@/lib/dashboardTenantScope';
import {
  ensureMissingReceiptNoticesForTenant,
  buildReceiptNoticeListFromTransfers,
} from '@/lib/stockTransferReceiptNotices';

async function enrichNoticesWithReceiptProduct(notices, tenantId) {
  return Promise.all(
    notices.map(async (n) => {
      const st = n.stockTransfer;
      const src = st?.product;
      let receiptProduct = src;
      if (src && st?.toBranchId && tenantId) {
        const orConds = [];
        if (src.sku) orConds.push({ sku: src.sku });
        if (src.name) orConds.push({ name: { equals: src.name, mode: 'insensitive' } });
        const dest =
          orConds.length > 0
            ? await prisma.product.findFirst({
                where: {
                  tenantId,
                  branchId: st.toBranchId,
                  isDeleted: false,
                  OR: orConds,
                },
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  cost: true,
                  averageCost: true,
                  lastPurchaseCost: true,
                },
              })
            : null;
        if (dest) receiptProduct = dest;
      }
      return { ...n, receiptProduct };
    })
  );
}

/**
 * GET — List stock received notices for the current business (receiving tenant).
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessible = await getAccessibleTenantIdsForUser(user);
    const scopeResult = parseDashboardTenantScope(searchParams, user, accessible);
    if (!scopeResult.ok) {
      return NextResponse.json(
        { error: scopeResult.error || 'Invalid business scope' },
        { status: 400 }
      );
    }
    const { tenantIds } = scopeResult;
    const tw = tenantWhereIn(tenantIds);

    for (const tid of tenantIds) {
      await ensureMissingReceiptNoticesForTenant(tid).catch((e) =>
        console.warn('[stock-transfer-receipts] ensure:', e?.message || e)
      );
    }

    let notices = [];
    let usedFallback = false;

    try {
      notices = await prisma.stockTransferReceiptNotice.findMany({
        where: tw,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          stockTransfer: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  cost: true,
                },
              },
              fromBranch: {
                select: {
                  id: true,
                  name: true,
                  tenant: { select: { id: true, name: true } },
                },
              },
              toBranch: {
                select: {
                  id: true,
                  name: true,
                  tenant: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
    } catch (e) {
      if (
        e.code === 'P2021' ||
        e.message?.includes('does not exist') ||
        e.message?.includes('Unknown model')
      ) {
        usedFallback = true;
        notices = await buildReceiptNoticeListFromTransfers(tenantIds[0]);
      } else {
        throw e;
      }
    }

    if (!usedFallback && notices.length === 0) {
      for (const tid of tenantIds) {
        const xferCount = await prisma.stockTransfer.count({
          where: {
            status: 'received',
            tenantId: { not: tid },
            toBranch: { tenantId: tid, isActive: true },
          },
        });
        if (xferCount > 0) {
          try {
            notices = await buildReceiptNoticeListFromTransfers(tid);
            usedFallback = true;
            break;
          } catch (fallbackErr) {
            console.warn('[stock-transfer-receipts] fallback:', fallbackErr?.message || fallbackErr);
          }
        }
      }
    }

    const unreadCount = notices.filter((n) => !n.readAt).length;
    const enriched = await Promise.all(
      notices.map(async (n) => {
        const noticeTenantId = n.tenantId || tenantIds[0];
        const [row] = await enrichNoticesWithReceiptProduct([n], noticeTenantId);
        return row;
      })
    );

    return NextResponse.json({ notices: enriched, unreadCount });
  } catch (error) {
    console.error('stock-transfer-receipts GET:', error);
    return NextResponse.json(
      { error: 'Failed to load stock transfer receipts' },
      { status: 500 }
    );
  }
}
