import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/subscriptionService';
import { syncBranchActiveStatus } from '@/lib/branchSubscriptionService';

// GET - list branches for current tenant
// Note: Listing branches doesn't require subscription check - only authentication
export async function GET(request) {
  try {
    // Only check authentication, not subscription
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Auto-deactivate expired branch subscriptions so the UI stays correct.
    await syncBranchActiveStatus(user.tenantId);

    const branches = await prisma.branch.findMany({
      where: {
        tenantId: user.tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, branches });
  } catch (error) {
    console.error('Error listing branches:', error);
    return NextResponse.json({ error: error.message || 'Failed to list branches' }, { status: 500 });
  }
}

// POST - create branch
// Note: First branch is free, additional branches require an active subscription
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const name = (body?.name || '').trim();
    const code = body?.code ? String(body.code).trim() : null;

    if (!name) {
      return NextResponse.json({ error: 'Branch name is required' }, { status: 400 });
    }

    // Check if branch name already exists for this tenant
    const existingBranch = await prisma.branch.findFirst({
      where: {
        tenantId: user.tenantId,
        name: name
      }
    });

    if (existingBranch) {
      return NextResponse.json({ 
        error: 'A branch with this name already exists' 
      }, { status: 400 });
    }

    // Check how many branches the tenant already has
    const existingBranches = await prisma.branch.findMany({
      where: {
        tenantId: user.tenantId
      }
    });

    // Branch-level billing:
    // - First branch is free
    // - Each additional branch must be paid separately
    // We still require the BUSINESS (tenant) itself to be subscribed to use the app.
    // This prevents bypassing tenant-level subscription entirely.
    const hasTenantPremium = await hasPremiumAccess(user.tenantId);

    // If tenant isn't subscribed, they shouldn't be managing branches at all.
    // (Keeps your existing "business requires subscription" requirement intact.)
    if (!hasTenantPremium) {
      return NextResponse.json(
        {
          error: 'Active business subscription required. Please subscribe to continue.',
          code: 'SUBSCRIPTION_REQUIRED',
          scope: 'tenant',
        },
        { status: 403 }
      );
    }

    // If this is NOT the first branch, enforce branch-level subscription.
    if (existingBranches.length > 0) {
      // Prevent creating unlimited unpaid branches:
      // If there is already an inactive branch for this tenant with no active subscription, force paying it first.
      const unpaidExisting = await prisma.branch.findFirst({
        where: { tenantId: user.tenantId, isActive: false },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true },
      });

      if (unpaidExisting) {
        const activePaidForThatBranch = await prisma.branchSubscription.findFirst({
          where: {
            tenantId: user.tenantId,
            branchId: unpaidExisting.id,
            isActive: true,
            expiresAt: { gt: new Date() },
            amount: { gt: 0 },
            status: { in: ['Completed', 'Active'] },
          },
          select: { id: true },
        });

        if (!activePaidForThatBranch) {
          return NextResponse.json(
            {
              error:
                'You have a pending branch that requires payment. Please subscribe for that branch before creating another.',
              code: 'BRANCH_SUBSCRIPTION_REQUIRED',
              scope: 'branch',
              branchId: unpaidExisting.id,
              branchName: unpaidExisting.name,
            },
            { status: 403 }
          );
        }
      }
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId: user.tenantId,
        name,
        code,
        // First branch is free and active; additional branches start inactive until paid.
        isActive: existingBranches.length === 0,
      },
    });

    // If it's an additional branch, force payment for THIS branch.
    if (existingBranches.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Branch subscription required to activate this branch.',
          code: 'BRANCH_SUBSCRIPTION_REQUIRED',
          scope: 'branch',
          branchId: branch.id,
          branchName: branch.name,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to create branch' }, { status: 500 });
  }
}







