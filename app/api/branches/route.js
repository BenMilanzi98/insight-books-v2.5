import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

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

    // If tenant already has at least one branch, require subscription for additional branches
    if (existingBranches.length > 0) {
      const accessError = await requireStandardAccess(request);
      if (accessError) return accessError;
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId: user.tenantId,
        name,
        code,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, branch }, { status: 201 });
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json({ error: error.message || 'Failed to create branch' }, { status: 500 });
  }
}







