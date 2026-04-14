import { getJwtSecret } from '@/lib/serverJwtSecret';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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

    // Get affiliate stats
    const [
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalCommissions,
      pendingPayouts,
      monthlyCommissions
    ] = await Promise.all([
      // Total referrals count
      prisma.affiliateReferral.count({
        where: { affiliateId: decoded.affiliateId }
      }),
      
      // Completed referrals count
      prisma.affiliateReferral.count({
        where: { 
          affiliateId: decoded.affiliateId,
          status: 'completed'
        }
      }),
      
      // Pending referrals count
      prisma.affiliateReferral.count({
        where: { 
          affiliateId: decoded.affiliateId,
          status: 'pending'
        }
      }),
      
      // Total commissions earned
      prisma.affiliateReferral.aggregate({
        where: { 
          affiliateId: decoded.affiliateId,
          status: 'completed'
        },
        _sum: {
          commissionAmount: true
        }
      }),
      
      // Pending payouts
      prisma.affiliatePayout.aggregate({
        where: { 
          affiliateId: decoded.affiliateId,
          status: 'pending'
        },
        _sum: {
          amount: true
        }
      }),
      
      // Monthly commissions (current month)
      prisma.affiliateReferral.aggregate({
        where: { 
          affiliateId: decoded.affiliateId,
          status: 'completed',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: {
          commissionAmount: true
        }
      })
    ]);

    const stats = {
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalCommissions: totalCommissions._sum.commissionAmount || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      monthlyCommissions: monthlyCommissions._sum.commissionAmount || 0
    };

    return NextResponse.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 