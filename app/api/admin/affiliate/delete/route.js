import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';


export async function POST(request) {
  try {
    console.log('Delete affiliate endpoint called');
    const body = await request.json();
    console.log('Request body:', body);
    const { affiliateId } = body;
    
    if (!affiliateId) {
      return NextResponse.json({ success: false, error: 'Affiliate ID is required' }, { status: 400 });
    }

    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Admin authenticated:', admin.email);
    console.log('Attempting to delete affiliate with ID:', affiliateId);

    // Check if affiliate exists
    const existingAffiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: {
        referrals: { select: { id: true } },
        payouts: { select: { id: true } }
      }
    });

    if (!existingAffiliate) {
      console.log('Affiliate not found:', affiliateId);
      return NextResponse.json({ success: false, error: 'Affiliate not found' }, { status: 404 });
    }

    // Check if affiliate has active referrals or pending payouts
    const hasActiveReferrals = existingAffiliate.referrals.length > 0;
    const hasPendingPayouts = existingAffiliate.payouts.length > 0;

    if (hasActiveReferrals || hasPendingPayouts) {
      console.log('Affiliate has active referrals or payouts, cannot delete');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete affiliate with active referrals or pending payouts. Consider deactivating instead.' 
        },
        { status: 400 }
      );
    }

    // Create admin audit log for affiliate deletion
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_DELETE',
        entityType: 'AFFILIATE',
        entityId: affiliateId,
        details: `Deleted affiliate: ${existingAffiliate.name} (${existingAffiliate.email})`,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        timestamp: new Date()
      }
    });

    console.log('Audit log created, proceeding with deletion');
    
    // Delete the affiliate
    await prisma.affiliate.delete({
      where: { id: affiliateId }
    });

    console.log('Affiliate deleted successfully:', affiliateId);
    
    return NextResponse.json({
      success: true,
      message: 'Affiliate deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting affiliate:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete affiliate: ' + error.message 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
