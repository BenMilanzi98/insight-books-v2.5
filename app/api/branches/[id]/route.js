import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
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
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const name = body?.name != null ? String(body.name).trim() : undefined;
    const code = body?.code != null ? String(body.code).trim() : undefined;
    const isActive = body?.isActive != null ? Boolean(body.isActive) : undefined;

    const existing = await prisma.branch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const branch = await prisma.branch.update({
      where: { id: params.id },
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
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const existing = await prisma.branch.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
    });
    if (!existing) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    if (hard) {
      // Hard delete is only allowed when there is no linked data
      const [sales, invoices, expenses, payments, transactions, journalEntries] = await Promise.all([
        prisma.sale.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
        prisma.invoice.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
        prisma.expense.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
        prisma.payment.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
        prisma.transaction.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
        prisma.journalEntry.count({ where: { tenantId: user.tenantId, branchId: params.id } }),
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

      await prisma.branch.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true, deleted: true });
    }

    // Soft delete: deactivate (keeps history intact)
    const branch = await prisma.branch.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete branch' }, { status: 500 });
  }
}


