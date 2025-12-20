import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAdminFromRequest } from '@/lib/adminAuth';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      subscriptionId, 
      amount, 
      currency, 
      paymentMethod, 
      txRef, 
      status = 'completed' 
    } = body;

    if (!subscriptionId || !amount || !txRef) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID, amount, and transaction reference are required' },
        { status: 400 }
      );
    }

    // Start transaction for payment processing and commission calculation
    const result = await prisma.$transaction(async (tx) => {
      // Update subscription status
      const updatedSubscription = await tx.accountSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: status === 'completed' ? 'Active' : 'Failed',
          isActive: status === 'completed',
          isTrial: false,
          amount: parseFloat(amount),
          currency: currency || 'MWK',
          paymentMethod: paymentMethod || 'bank',
          txRef: txRef,
          updatedAt: new Date()
        },
        include: {
          tenant: {
            include: {
              users: {
                where: { role: 'owner' },
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      // If payment is successful, handle affiliate commission
      if (status === 'completed') {
        // Find affiliate referral for this tenant
        const affiliateReferral = await tx.affiliateReferral.findFirst({
          where: { 
            tenantId: updatedSubscription.tenantId,
            status: 'pending'
          },
          include: {
            affiliate: true
          }
        });

        if (affiliateReferral && affiliateReferral.affiliate) {
          // Calculate commission (20% of subscription amount)
          const commissionAmount = parseFloat(amount) * 0.20;

          // Update affiliate referral with commission
          await tx.affiliateReferral.update({
            where: { id: affiliateReferral.id },
            data: {
              status: 'completed',
              commissionAmount: commissionAmount,
              updatedAt: new Date()
            }
          });

          // Update affiliate stats
          await tx.affiliate.update({
            where: { id: affiliateReferral.affiliate.id },
            data: {
              totalSales: { increment: parseFloat(amount) },
              totalCommissions: { increment: commissionAmount },
              totalReferrals: { increment: 1 },
              updatedAt: new Date()
            }
          });

          // Create commission payout record
          await tx.affiliatePayout.create({
            data: {
              affiliateId: affiliateReferral.affiliate.id,
              amount: commissionAmount,
              paymentMethod: affiliateReferral.affiliate.paymentMethod || 'bank',
              status: 'pending',
              reference: `COMM-${affiliateReferral.id}`,
              createdAt: new Date()
            }
          });

          // Create admin audit log
          await tx.adminAuditLog.create({
            data: {
              adminId: admin.id,
              action: 'COMMISSION_CALCULATED',
              entityType: 'AFFILIATE_REFERRAL',
              entityId: affiliateReferral.id,
              details: `Commission calculated for affiliate ${affiliateReferral.affiliate.name}: MWK ${commissionAmount.toLocaleString()} (${(0.20 * 100)}% of ${amount})`,
              ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
              userAgent: request.headers.get('user-agent') || 'unknown'
            }
          });
        }
      }

      return {
        subscription: updatedSubscription,
        commissionCalculated: status === 'completed' && affiliateReferral ? true : false
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription payment processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Subscription payment error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process subscription payment' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 