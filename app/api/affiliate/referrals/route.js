import { getJwtSecret } from '@/lib/serverJwtSecret';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';


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

    let decoded;
    try {
      decoded = jwt.verify(affiliateToken, getJwtSecret());
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