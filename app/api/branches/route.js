import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { hasStandardAccess } from '@/lib/subscriptionService';
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

    // Auto-deactivate expired branch subscriptions so the UI stays correct.
    await syncBranchActiveStatus(user.tenantId);

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive');
    const scope = searchParams.get('scope');

    // Branch assignment (allowedBranchIds) limits which branches appear in switchers and
    // operational UIs. It must NOT block the /branches management screen: users with
    // branch-management permissions can list every tenant branch when scope=full.
    // Also: [] is truthy in JS — we must only filter when the array is non-empty, otherwise
    // `id: { in: [] }` hides all rows and new branches never appear after create.
    const canListAllTenantBranches =
      scope === 'full' &&
      (hasPermission(user, 'branches.create') ||
        hasPermission(user, 'branches.update') ||
        user.role?.name === 'MASTER_ADMIN');

    const assignedIds = Array.isArray(user.allowedBranchIds) ? user.allowedBranchIds : null;
    const restrictToAssigned =
      !canListAllTenantBranches && assignedIds != null && assignedIds.length > 0;

    const where = {
      tenantId: user.tenantId,
      ...(includeInactive === 'false' ? { isActive: true } : {}),
      ...(restrictToAssigned ? { id: { in: assignedIds } } : {}),
      ...(!canListAllTenantBranches && assignedIds != null && assignedIds.length === 0
        ? { id: { in: [] } }
        : {}),
    };

    const branches = await prisma.branch.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    if (branches.length === 0) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true },
      });
      const label = tenant?.name?.trim() ? `${tenant.name.trim()} (Main location)` : 'Main location';
      return NextResponse.json({
        success: true,
        branches: [
          {
            id: null,
            name: label,
            code: null,
            isActive: true,
            isVirtual: true,
          },
        ],
        tenantHasNoBranchRecords: true,
      });
    }

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
    const tenantCanUseApp = await hasStandardAccess(user.tenantId);

    // Trial or paid: tenant must have standard access (same bar as the rest of the app).
    if (!tenantCanUseApp) {
      return NextResponse.json(
        {
          error: 'Active subscription or trial required. Please subscribe to continue.',
          code: 'SUBSCRIPTION_REQUIRED',
          scope: 'tenant',
        },
        { status: 403 }
      );
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

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to create branch' }, { status: 500 });
  }
}







