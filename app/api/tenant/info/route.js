import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tenantId = searchParams.get('tenantId');

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: 'User ID and Tenant ID are required' },
        { status: 400 }
      );
    }

    // Verify user and get tenant info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Invalid tenant association' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
        settings: user.tenant.settings
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Tenant info error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant information' },
      { status: 500 }
    );
  }
} 