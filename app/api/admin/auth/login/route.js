import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const emailRaw = typeof body?.email === 'string' ? body.email.trim() : '';
    const passwordRaw = typeof body?.password === 'string' ? body.password : '';

    if (!emailRaw || !passwordRaw) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const emailNorm = emailRaw.toLowerCase();

    // Find admin user
    const admin = await prisma.admin.findUnique({
      where: { email: emailNorm },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        isActive: true,
        permissions: true
      }
    });

    // Check if admin exists and is active
    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials or account inactive' },
        { status: 401 }
      );
    }

    // Verify password
    let isValidPassword = false;
    try {
      if (!admin.password || typeof admin.password !== 'string') {
        isValidPassword = false;
      } else {
        isValidPassword = await bcrypt.compare(passwordRaw, admin.password);
      }
    } catch (compareErr) {
      console.error('Admin login bcrypt error:', compareErr);
      isValidPassword = false;
    }
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login (non-fatal)
    try {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLogin: new Date() },
      });
    } catch (e) {
      console.error('Admin login lastLogin update skipped:', e?.message || e);
    }

    // Audit log (non-fatal — login must succeed even if log table fails)
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'LOGIN',
          entityType: 'ADMIN',
          entityId: admin.id,
          details: 'Admin logged in successfully',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    } catch (e) {
      console.error('Admin login audit log skipped:', e?.message || e);
    }

    // Generate JWT token (requires JWT_SECRET in production)
    let secret;
    try {
      secret = getJwtSecret();
    } catch (secretErr) {
      if (
        secretErr?.message?.includes('JWT_SECRET') ||
        secretErr?.message?.includes('SESSION_SECRET') ||
        secretErr?.message?.includes('production')
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Sign-in is temporarily unavailable: signing secret is not configured on this server. Set JWT_SECRET (recommended) or SESSION_SECRET (16+ characters) in the deployment environment.',
          },
          { status: 503 }
        );
      }
      throw secretErr;
    }

    let token;
    try {
      token = jwt.sign(
        {
          adminId: admin.id,
          email: admin.email,
          role: admin.role,
          isAdmin: true,
        },
        secret,
        { expiresIn: '24h' }
      );
    } catch (signErr) {
      console.error('Admin login JWT sign error:', signErr);
      return NextResponse.json(
        {
          success: false,
          error: 'Sign-in failed while issuing a session token. Check server logs and JWT configuration.',
        },
        { status: 503 }
      );
    }

    // Create response with admin data
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions
      }
    });

    // Set HTTP-only cookie (sameSite: lax so cookie is sent on same-origin fetch and top-level nav)
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Add other HTTP methods as needed
export async function GET() {
  return NextResponse.json({ message: 'Admin login endpoint' });
} 