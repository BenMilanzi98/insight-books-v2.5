import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Affiliate ID is required' },
        { status: 400 }
      );
    }

    // Check if affiliate exists
    const existingAffiliate = await prisma.affiliate.findUnique({
      where: { id }
    });

    if (!existingAffiliate) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Fetch referrals for this affiliate
    const referrals = await prisma.affiliateReferral.findMany({
      where: { affiliateId: id },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data for frontend
    const transformedReferrals = referrals.map(referral => ({
      id: referral.id,
      affiliateId: referral.affiliateId,
      tenantId: referral.tenantId,
      commissionAmount: referral.commissionAmount,
      status: referral.status,
      createdAt: referral.createdAt,
      updatedAt: referral.updatedAt
    }));

    return NextResponse.json({
      success: true,
      referrals: transformedReferrals
    });

  } catch (error) {
    console.error('Error fetching referrals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch referrals' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 