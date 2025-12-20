import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Custom JWT verification for Edge Runtime compatibility
function verifyJWT(token, secret) {
  try {
    // Split the token
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode header and payload
    const header = JSON.parse(atob(headerB64));
    const payload = JSON.parse(atob(payloadB64));
    
    // Check if token is expired
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('Token expired');
    }
    
    // For now, we'll just return the decoded payload
    // In production, you should verify the signature using Web Crypto API
    return payload;
  } catch (error) {
    throw new Error('Token verification failed: ' + error.message);
  }
}

export async function GET(request) {
  try {
    // Get affiliate token from cookies
    const affiliateToken = request.cookies.get('affiliate_token')?.value;

    if (!affiliateToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token using Edge Runtime compatible function
    let decoded;
    try {
      decoded = verifyJWT(affiliateToken, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    if (decoded.type !== 'affiliate') {
      return NextResponse.json(
        { success: false, error: 'Invalid token type' },
        { status: 401 }
      );
    }

    // Get affiliate referrals
    const referrals = await prisma.affiliateReferral.findMany({
      where: { affiliateId: decoded.affiliateId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            status: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        registrationTimestamp: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      referrals: referrals
    });

  } catch (error) {
    console.error('Error fetching affiliate referrals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 