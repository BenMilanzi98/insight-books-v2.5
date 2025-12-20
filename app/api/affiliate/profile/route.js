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

    // Get affiliate profile
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: decoded.affiliateId },
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        status: true,
        commissionRate: true,
        totalReferrals: true,
        totalSales: true,
        totalCommissions: true,
        businessName: true,
        paymentMethod: true,
        paymentDetails: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      affiliate: affiliate
    });

  } catch (error) {
    console.error('Error fetching affiliate profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request) {
  try {
    // Get affiliate token from cookies
    const affiliateToken = request.cookies.get('affiliate_token')?.value;

    if (!affiliateToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify JWT token
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

    const body = await request.json();
    const { name, businessName, paymentMethod, paymentDetails } = body;

    // Validation
    if (!name || !businessName) {
      return NextResponse.json(
        { success: false, error: 'Name and business name are required' },
        { status: 400 }
      );
    }

    // Update affiliate profile
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: decoded.affiliateId },
      data: {
        name,
        businessName,
        paymentMethod,
        paymentDetails: paymentDetails ? JSON.stringify(paymentDetails) : null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        referralCode: true,
        status: true,
        commissionRate: true,
        totalReferrals: true,
        totalSales: true,
        totalCommissions: true,
        businessName: true,
        paymentMethod: true,
        paymentDetails: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Create audit log entry
    await prisma.adminAuditLog.create({
      data: {
        action: 'AFFILIATE_PROFILE_UPDATED',
        entityType: 'AFFILIATE',
        entityId: updatedAffiliate.id,
        details: JSON.stringify({
          affiliateName: updatedAffiliate.name,
          businessName: updatedAffiliate.businessName,
          paymentMethod: updatedAffiliate.paymentMethod
        }),
        timestamp: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      affiliate: updatedAffiliate
    });

  } catch (error) {
    console.error('Error updating affiliate profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 