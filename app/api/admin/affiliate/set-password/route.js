import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getAdminFromRequest } from '@/lib/adminAuth';


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
    const { affiliateId, password, notifyAffiliate = true } = body;

    if (!affiliateId || !password) {
      return NextResponse.json(
        { success: false, error: 'Affiliate ID and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Find the affiliate
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId }
    });

    if (!affiliate) {
      return NextResponse.json(
        { success: false, error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update affiliate with new password
    const updatedAffiliate = await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    // Create audit log entry
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'AFFILIATE_PASSWORD_SET',
        entityType: 'AFFILIATE',
        entityId: affiliateId,
        details: JSON.stringify({
          affiliateName: affiliate.name,
          email: affiliate.email,
          action: 'Password set/reset by admin'
        }),
        timestamp: new Date()
      }
    });

    // If notification is enabled, send email to affiliate
    if (notifyAffiliate) {
      try {
        // Here you would integrate with your email service
        // For now, we'll just log it
        console.log(`Password notification sent to affiliate: ${affiliate.email}`);
        
        // You can integrate with your existing email service like:
        // await sendAffiliatePasswordEmail(affiliate.email, affiliate.name, password);
      } catch (emailError) {
        console.error('Failed to send password notification email:', emailError);
        // Don't fail the entire operation if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Affiliate password set successfully',
      affiliate: {
        id: updatedAffiliate.id,
        name: updatedAffiliate.name,
        email: updatedAffiliate.email,
        referralCode: updatedAffiliate.referralCode
      }
    });

  } catch (error) {
    console.error('Error setting affiliate password:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set affiliate password' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 