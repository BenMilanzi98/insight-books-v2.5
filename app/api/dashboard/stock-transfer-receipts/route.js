import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

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

    let notices = [];
    try {
      notices = await prisma.stockTransferReceiptNotice.findMany({
        where: { tenantId: user.tenantId },
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
      if (e.code === 'P2021' || e.message?.includes('does not exist')) {
        notices = [];
      } else {
        throw e;
      }
    }

    const unreadCount = notices.filter((n) => !n.readAt).length;

    // StockTransfer.productId points at the source catalog; resolve destination product for this business
    const enriched = await Promise.all(
      notices.map(async (n) => {
        const st = n.stockTransfer;
        const src = st?.product;
        let receiptProduct = src;
        if (src && st?.toBranchId && user.tenantId) {
          const orConds = [];
          if (src.sku) orConds.push({ sku: src.sku });
          if (src.name) orConds.push({ name: { equals: src.name, mode: 'insensitive' } });
          const dest =
            orConds.length > 0
              ? await prisma.product.findFirst({
            where: {
              tenantId: user.tenantId,
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

    return NextResponse.json({ notices: enriched, unreadCount });
  } catch (error) {
    console.error('stock-transfer-receipts GET:', error);
    return NextResponse.json(
      { error: 'Failed to load stock transfer receipts' },
      { status: 500 }
    );
  }
}
