import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

/**
 * POST /api/profile/deactivate
 * Authenticated user soft-deletes their own account (inactive, cannot log in).
 * Requires current password confirmation.
 */
export async function POST(request) {
  try {
    const userItem = await getUserFromSession(request);
    if (!userItem) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const password =
      typeof body?.password === 'string' ? body.password : '';
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to delete your account' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userItem.id },
      select: {
        id: true,
        email: true,
        password: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is already inactive' },
        { status: 400 },
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'This account cannot be deleted from the app. Contact support.' },
        { status: 400 },
      );
    }

    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.password);
    } catch {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 400 },
      );
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        status: 'inactive',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_SELF_DEACTIVATED',
        entityType: 'USER',
        entityId: user.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          reason: 'User requested account deletion (self-service)',
          email: user.email,
        }),
      },
    });

    const cookieStore = await cookies();
    cookieStore.delete('session');

    return NextResponse.json({
      message: 'Your account has been deactivated. You will be signed out.',
    });
  } catch (error) {
    console.error('Profile deactivate error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate account. Please try again.' },
      { status: 500 },
    );
  }
}
