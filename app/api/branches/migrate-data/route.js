import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * Migration endpoint to assign existing data to branches
 * POST /api/branches/migrate-data
 * Body: { branchId: string, assignTo: 'default' | 'specific' }
 * 
 * Options:
 * - assignTo: 'default' - Assign all null branchId records to user's default branch
 * - assignTo: 'specific' - Assign all null branchId records to the provided branchId
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
    const { branchId, assignTo = 'default' } = body;

    // Determine target branch
    let targetBranchId = null;
    if (assignTo === 'default') {
      targetBranchId = user.defaultBranchId;
    } else if (assignTo === 'specific' && branchId) {
      // Validate branch belongs to tenant
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId: user.tenantId, isActive: true }
      });
      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      targetBranchId = branchId;
    } else {
      return NextResponse.json({ error: 'Invalid assignTo option or missing branchId' }, { status: 400 });
    }

    if (!targetBranchId) {
      return NextResponse.json({ 
        error: 'No target branch found. Please set a default branch or provide a specific branchId.',
        suggestion: 'Go to User Management and set a default branch for your user, or create a branch first.'
      }, { status: 400 });
    }

    // Count existing records with null branchId
    const counts = {
      sales: await prisma.sale.count({ where: { tenantId: user.tenantId, branchId: null } }),
      invoices: await prisma.invoice.count({ where: { tenantId: user.tenantId, branchId: null } }),
      expenses: await prisma.expense.count({ where: { tenantId: user.tenantId, branchId: null } }),
      payments: await prisma.payment.count({ where: { tenantId: user.tenantId, branchId: null } }),
      products: await prisma.product.count({ where: { tenantId: user.tenantId, branchId: null } }),
      transactions: await prisma.transaction.count({ where: { tenantId: user.tenantId, branchId: null } }),
      journalEntries: await prisma.journalEntry.count({ where: { tenantId: user.tenantId, branchId: null } })
    };

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (totalRecords === 0) {
      return NextResponse.json({ 
        message: 'No records found to migrate. All data is already assigned to branches.',
        counts 
      });
    }

    // Perform migration in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const updates = {};

      if (counts.sales > 0) {
        updates.sales = await tx.sale.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.invoices > 0) {
        updates.invoices = await tx.invoice.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.expenses > 0) {
        updates.expenses = await tx.expense.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.payments > 0) {
        updates.payments = await tx.payment.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.products > 0) {
        updates.products = await tx.product.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.transactions > 0) {
        updates.transactions = await tx.transaction.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      if (counts.journalEntries > 0) {
        updates.journalEntries = await tx.journalEntry.updateMany({
          where: { tenantId: user.tenantId, branchId: null },
          data: { branchId: targetBranchId }
        });
      }

      return updates;
    });

    // Get the branch name for response
    const branch = await prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { name: true, code: true }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${totalRecords} records to branch: ${branch.name}${branch.code ? ` (${branch.code})` : ''}`,
      branchId: targetBranchId,
      branchName: branch.name,
      counts,
      updated: {
        sales: results.sales?.count || 0,
        invoices: results.invoices?.count || 0,
        expenses: results.expenses?.count || 0,
        payments: results.payments?.count || 0,
        products: results.products?.count || 0,
        transactions: results.transactions?.count || 0,
        journalEntries: results.journalEntries?.count || 0
      }
    });
  } catch (error) {
    console.error('Error migrating data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to migrate data' },
      { status: 500 }
    );
  }
}

// GET - Preview migration (count records without branchId)
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Count existing records with null branchId
    const counts = {
      sales: await prisma.sale.count({ where: { tenantId: user.tenantId, branchId: null } }),
      invoices: await prisma.invoice.count({ where: { tenantId: user.tenantId, branchId: null } }),
      expenses: await prisma.expense.count({ where: { tenantId: user.tenantId, branchId: null } }),
      payments: await prisma.payment.count({ where: { tenantId: user.tenantId, branchId: null } }),
      products: await prisma.product.count({ where: { tenantId: user.tenantId, branchId: null } }),
      transactions: await prisma.transaction.count({ where: { tenantId: user.tenantId, branchId: null } }),
      journalEntries: await prisma.journalEntry.count({ where: { tenantId: user.tenantId, branchId: null } })
    };

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);

    // Get available branches
    const branches = await prisma.branch.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, code: true }
    });

    return NextResponse.json({
      totalRecords,
      counts,
      branches,
      userDefaultBranchId: user.defaultBranchId,
      hasDataToMigrate: totalRecords > 0
    });
  } catch (error) {
    console.error('Error previewing migration:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview migration' },
      { status: 500 }
    );
  }
}





