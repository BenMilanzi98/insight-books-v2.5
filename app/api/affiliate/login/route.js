import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

    // Generate JWT token (exact same pattern as admin login)
    console.log('🔑 Login API: JWT_SECRET set:', !!process.env.JWT_SECRET);
    console.log('🔑 Login API: JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
    
    const token = jwt.sign(
      {
        affiliateId: affiliate.id,
        email: affiliate.email,
        type: 'affiliate',
        isAffiliate: true
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    console.log('🔑 Login API: Token generated:', token.substring(0, 20) + '...');
    console.log('🔑 Login API: Token payload:', {
      affiliateId: affiliate.id,
      email: affiliate.email,
      type: 'affiliate',
      isAffiliate: true
    });

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
      secure: (process.env.APP_URL || '').startsWith('https'),
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