import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
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

    const tenantId = user.tenantId;

    await ensureMissingReceiptNoticesForTenant(tenantId).catch((e) =>
      console.warn('[stock-transfer-receipts] ensure:', e?.message || e)
    );

    let notices = [];
    let usedFallback = false;

    try {
      notices = await prisma.stockTransferReceiptNotice.findMany({
        where: { tenantId },
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
        notices = await buildReceiptNoticeListFromTransfers(tenantId);
      } else {
        throw e;
      }
    }

    if (!usedFallback && notices.length === 0) {
      const xferCount = await prisma.stockTransfer.count({
        where: {
          status: 'received',
          tenantId: { not: tenantId },
          toBranch: { tenantId, isActive: true },
        },
      });
      if (xferCount > 0) {
        try {
          notices = await buildReceiptNoticeListFromTransfers(tenantId);
          usedFallback = true;
        } catch (fallbackErr) {
          console.warn('[stock-transfer-receipts] fallback:', fallbackErr?.message || fallbackErr);
        }
      }
    }

    const unreadCount = notices.filter((n) => !n.readAt).length;
    const enriched = await enrichNoticesWithReceiptProduct(notices, tenantId);

    return NextResponse.json({ notices: enriched, unreadCount });
  } catch (error) {
    console.error('stock-transfer-receipts GET:', error);
    return NextResponse.json(
      { error: 'Failed to load stock transfer receipts' },
      { status: 500 }
    );
  }
}
