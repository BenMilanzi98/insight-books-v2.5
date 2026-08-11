import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/serverJwtSecret';


export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find affiliate by email
    const affiliate = await prisma.affiliate.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if affiliate is active
    if (affiliate.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Your affiliate account is not active. Please contact support.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, affiliate.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    let token;
    try {
      token = jwt.sign(
        {
          affiliateId: affiliate.id,
          email: affiliate.email,
          type: 'affiliate',
          isAffiliate: true
        },
        getJwtSecret(),
        { expiresIn: '24h' }
      );
    } catch (signErr) {
      if (
        signErr?.message?.includes('JWT_SECRET') ||
        signErr?.message?.includes('SESSION_SECRET') ||
        signErr?.message?.includes('production')
      ) {
        return NextResponse.json(
          { success: false, error: 'Server configuration error' },
          { status: 503 }
        );
      }
      throw signErr;
    }

    // Set cookie
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        referralCode: affiliate.referralCode,
        status: affiliate.status
      }
    });

    // Set secure HTTP-only cookie (exact same pattern as admin login)
    response.cookies.set('affiliate_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours (same as admin)
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Affiliate login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 