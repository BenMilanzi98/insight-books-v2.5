// app/api/users/send-email/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';

// POST - Send email to a specific user
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'users.update');
    if (perm) return perm;

    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId, subject, message, emailType = 'custom' } = body;

    if (!userId || !subject || !message) {
      return NextResponse.json(
        { error: 'User ID, subject and message are required' },
        { status: 400 }
      );
    }
    
    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: user.tenantId // Ensure tenant isolation
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // For now, just log the email (in a real app, you'd send it via email service)
    console.log('Email to be sent:', {
      to: targetUser.email,
      subject,
      message,
      emailType,
      from: user.email,
      tenantId: user.tenantId
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'EMAIL_SENT',
        entityType: 'USER',
        entityId: userId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          emailType,
          subject,
          recipient: targetUser.email
        })
      }
    });

    return NextResponse.json({
      message: 'Email sent successfully',
      email: {
        to: targetUser.email,
        subject,
        emailType
      }
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email. Please try again.' },
      { status: 500 }
    );
  }
} 