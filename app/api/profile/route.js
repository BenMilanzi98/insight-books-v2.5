import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import bcrypt from 'bcrypt';

// Helper: get authenticated user ID (replace with your auth logic)
async function getCurrentUserId(request) {
  // e.g. from token/cookie
  return 'user-id-from-session';
}

export async function GET(request) {
    // Get user from session
    const userItem = await getUserFromSession(request);
    if (!userItem) {
        return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
        );
    }
  const userId = await userItem.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      tenant: true
    }
  });

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    phone: user.phone,
    department: user.department,
    role: user.role?.name,
    tenant: user.tenant?.name
  });
}

export async function POST(request) {
// Get user from session
const userItem = await getUserFromSession(request);
if (!userItem) {
    return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
    );
}
  const userId = await userItem.id;
  const data = await request.json();

  if (data.profile) {
    // Update profile info
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.profile.name,
        phone: data.profile.phone
      }
    });
    return NextResponse.json({ message: 'Profile updated' });
  }

  if (data.passwordUpdate) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const valid = await bcrypt.compare(data.passwordUpdate.currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ message: 'Current password incorrect' }, { status: 400 });
    }
    // Hash the password with bcrypt
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(data.passwordUpdate.newPassword, 10);
    } catch (hashError) {
      console.error('Password hashing error:', hashError);
      return NextResponse.json(
        { error: 'Error creating account. Please try again.' },
        { status: 500 }
      );
    }
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return NextResponse.json({ message: 'Password updated' });
  }

  return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
}
