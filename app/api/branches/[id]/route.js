import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getFreeBranchId, hasActiveBranchSubscription } from '@/lib/branchSubscriptionService';

// Note: Branch management (GET, PUT, DELETE) doesn't require subscription check
// Branches are part of the same tenant - only authentication is required
export async function GET(request, { params }) {
  try {
    // Only check authentication, not subscription
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Next.js dynamic route params can be async depending on version/runtime
    const { id } = (await params) || params || {};

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Error fetching branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch branch' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    // Only check authentication, not subscription
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = (await params) || params || {};

    const body = await request.json();
    const name = body?.name != null ? String(body.name).trim() : undefined;
    const code = body?.code != null ? String(body.code).trim() : undefined;
    const isActive = body?.isActive != null ? Boolean(body.isActive) : undefined;

    const existing = await prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    // If attempting to activate an inactive branch, require an active branch subscription
    // (except the free branch for the tenant).
    if (isActive === true && existing.isActive === false) {
      const freeBranchId = await getFreeBranchId(user.tenantId);
      const isFreeBranch = freeBranchId && freeBranchId === id;
      if (!isFreeBranch) {
        const ok = await hasActiveBranchSubscription(user.tenantId, id);
        if (!ok) {
          return NextResponse.json(
            {
              error: 'Branch subscription required to activate this branch.',
              code: 'BRANCH_SUBSCRIPTION_REQUIRED',
              scope: 'branch',
              branchId: id,
            },
            { status: 403 }
          );
        }
      }
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to update branch' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    // Only check authentication, not subscription
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = (await params) || params || {};

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const existing = await prisma.branch.findFirst({
      where: { id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    if (hard) {
      // Hard delete is only allowed when there is no linked data
      const [sales, invoices, expenses, payments, transactions, journalEntries] = await Promise.all([
        prisma.sale.count({ where: { tenantId: user.tenantId, branchId: id } }),
        prisma.invoice.count({ where: { tenantId: user.tenantId, branchId: id } }),
        prisma.expense.count({ where: { tenantId: user.tenantId, branchId: id } }),
        prisma.payment.count({ where: { tenantId: user.tenantId, branchId: id } }),
        prisma.transaction.count({ where: { tenantId: user.tenantId, branchId: id } }),
        prisma.journalEntry.count({ where: { tenantId: user.tenantId, branchId: id } }),
      ]);

      const totalLinked = sales + invoices + expenses + payments + transactions + journalEntries;
      if (totalLinked > 0) {
        return NextResponse.json(
          {
            error:
              'Branch has linked transactions and cannot be permanently deleted. Deactivate it instead.',
            linked: { sales, invoices, expenses, payments, transactions, journalEntries },
          },
          { status: 400 }
        );
      }

      await prisma.branch.delete({ where: { id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Soft delete: deactivate (keeps history intact)
    const branch = await prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete branch' }, { status: 500 });
  }
}


