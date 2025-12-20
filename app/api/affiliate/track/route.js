import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { referralCode, userAgent, referrer, timestamp } = body;

    if (!referralCode) {
      return NextResponse.json(
        { success: false, error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Find affiliate by referral code
    const affiliate = await prisma.affiliate.findUnique({
      where: { referralCode: referralCode }
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

    // Create a referral record (this would typically be linked to a tenant/user signup)
    // For now, we'll just log the click
    const referralClick = await prisma.affiliateReferral.create({
      data: {
        affiliateId: affiliate.id,
        tenantId: 'temp-tenant-id', // This would be the actual tenant ID when they sign up
        commissionAmount: 0, // No commission for just a click
        status: 'clicked', // New status for tracking clicks
        createdAt: new Date(timestamp || Date.now())
      }
    });

    // In a real implementation, you might want to:
    // 1. Store the referral in a session/cookie
    // 2. Link it to the actual user signup later
    // 3. Calculate commission when the user makes a purchase
    // 4. Update the referral status to 'completed' when criteria are met

    return NextResponse.json({
      success: true,
      message: 'Referral tracked successfully',
      referralId: referralClick.id
    });

  } catch (error) {
    console.error('Error tracking referral:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track referral' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 