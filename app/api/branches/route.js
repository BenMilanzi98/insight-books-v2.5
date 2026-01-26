import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// GET - list branches for current tenant
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

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
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

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






