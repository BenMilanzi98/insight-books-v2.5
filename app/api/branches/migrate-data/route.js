import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { resolveHiddenPrimaryBranchId } from '@/lib/hiddenPrimaryBranch';
import { countNullBranchIdsForTenant, backfillPrimaryBranchForTenant } from '@/lib/backfillPrimaryBranch';
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

    let targetBranchId = null;
    if (assignTo === 'specific' && branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId: user.tenantId, isActive: true },
      });
      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch' }, { status: 400 });
      }
      targetBranchId = branchId;
    } else {
      targetBranchId = await resolveHiddenPrimaryBranchId(user.tenantId);
    }

    if (!targetBranchId) {
      return NextResponse.json({
        error: 'No primary branch found for this business.',
      }, { status: 400 });
    }

    const counts = await countNullBranchIdsForTenant(user.tenantId);

    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);

    if (totalRecords === 0) {
      return NextResponse.json({ 
        message: 'No records found to migrate. All data is already assigned to branches.',
        counts 
      });
    }

    const result = await backfillPrimaryBranchForTenant(user.tenantId, { dryRun: false });
    const branch = await prisma.branch.findUnique({
      where: { id: targetBranchId },
      select: { name: true, code: true },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${result.totalUpdated ?? totalRecords} records to primary location: ${branch?.name || 'Main location'}${branch?.code ? ` (${branch.code})` : ''}`,
      branchId: targetBranchId,
      branchName: branch?.name || 'Main location',
      counts: result.counts,
      updated: result.updated,
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

    const counts = await countNullBranchIdsForTenant(user.tenantId);
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const primaryBranchId = await resolveHiddenPrimaryBranchId(user.tenantId);

    return NextResponse.json({
      totalRecords,
      counts,
      primaryBranchId,
      hasDataToMigrate: totalRecords > 0,
    });
  } catch (error) {
    console.error('Error previewing migration:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview migration' },
      { status: 500 }
    );
  }
}







