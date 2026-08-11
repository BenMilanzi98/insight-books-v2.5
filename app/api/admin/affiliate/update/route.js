import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';


export async function POST(request) {
  try {
    console.log('Update affiliate endpoint called');
    const body = await request.json();
    console.log('Request body:', body);
    const { affiliateId, ...updateData } = body;
    
    if (!affiliateId) {
      return NextResponse.json({ success: false, error: 'Affiliate ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Admin authenticated:', admin.email);
    console.log('Attempting to update affiliate with ID:', affiliateId);

    const { name, email, businessName, commissionRate, status, paymentMethod, bankDetails } = updateData;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    // Validate commission rate if provided
    if (commissionRate && (commissionRate < 1 || commissionRate > 50)) {
      return NextResponse.json({ success: false, error: 'Commission rate must be between 1% and 50%' }, { status: 400 });
    }

    // Check if affiliate exists
    const existingAffiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId }
    });

    if (!existingAffiliate) {
      console.log('Affiliate not found:', affiliateId);
      return NextResponse.json({ success: false, error: 'Affiliate not found' }, { status: 404 });
    }

    // Check if email is being changed and if it conflicts with another affiliate
    if (email !== existingAffiliate.email) {
      const emailConflict = await prisma.affiliate.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (emailConflict && emailConflict.id !== affiliateId) {
        console.log('Email conflict detected:', email);
        return NextResponse.json({ 
          success: false, 
          error: 'An affiliate with this email already exists' 
        }, { status: 400 });
      }
    }

    console.log('Affiliate found, proceeding with update');

    // Create admin audit log for affiliate update
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_UPDATE',
        entityType: 'AFFILIATE',
        entityId: affiliateId,
        details: `Updated affiliate: ${name} (${email})`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    });

    // Update the affiliate
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        businessName: businessName || existingAffiliate.businessName,
        commissionRate: commissionRate || existingAffiliate.commissionRate,
        status: status || existingAffiliate.status,
        paymentMethod: paymentMethod || existingAffiliate.paymentMethod,
        paymentDetails: JSON.stringify(bankDetails || {}),
        updatedAt: new Date()
      },
      include: {
        referrals: {
          select: {
            id: true,
            commissionAmount: true,
            status: true,
            createdAt: true
          }
        },
        payouts: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    console.log('Affiliate updated successfully:', affiliateId);

    // Transform the response
    const totalSales = updatedAffiliate.referrals
      .filter(ref => ref.status === 'completed')
      .reduce((sum, ref) => sum + (ref.commissionAmount || 0), 0);
    
    // Use commission rate from schema or default
    const calculatedCommissionRate = updatedAffiliate.commissionRate || 30;
    const totalCommissions = totalSales * (calculatedCommissionRate / 100);
    
    const pendingPayouts = updatedAffiliate.payouts
      .filter(payout => payout.status === 'pending')
      .reduce((sum, payout) => sum + (payout.amount || 0), 0);

    const transformedAffiliate = {
      id: updatedAffiliate.id,
      name: updatedAffiliate.name,
      email: updatedAffiliate.email,
      businessName: updatedAffiliate.businessName || '',
      affiliateCode: updatedAffiliate.referralCode,
      status: updatedAffiliate.status,
      commissionRate: calculatedCommissionRate,
      paymentMethod: updatedAffiliate.paymentMethod,
      bankDetails: updatedAffiliate.paymentDetails,
      totalSales: totalSales,
      totalCommissions: totalCommissions,
      pendingPayouts: pendingPayouts,
      referralCount: updatedAffiliate.referrals.length,
      hasPassword: !!updatedAffiliate.password,
      createdAt: updatedAffiliate.createdAt,
      updatedAt: updatedAffiliate.updatedAt
    };

    return NextResponse.json({
      success: true,
      message: 'Affiliate updated successfully',
      affiliate: transformedAffiliate
    });

  } catch (error) {
    console.error('Error updating affiliate:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update affiliate: ' + error.message 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
