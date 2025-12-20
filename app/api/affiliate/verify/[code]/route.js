import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const { code } = params;
    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find affiliate by referral code
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode: code }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Invalid referral code' },
        { status: 404 }
      );
    }

    // Check if affiliate is active
    if (affiliate.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Affiliate account is not active' },
        { status: 400 }
      );
    }

    // Transform the response
    const transformedAffiliate = {
      id: affiliate.id,
      name: affiliate.name,
      email: affiliate.email,
      affiliateCode: affiliate.referralCode,
      status: affiliate.status,
      paymentMethod: affiliate.paymentMethod,
      bankDetails: JSON.parse(affiliate.paymentDetails || '{}'),
      createdAt: affiliate.createdAt,
      updatedAt: affiliate.updatedAt
    };

    return NextResponse.json({
      success: true,
      affiliate: transformedAffiliate
    });

  } catch (error) {
    console.error('Error verifying affiliate:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify affiliate' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 