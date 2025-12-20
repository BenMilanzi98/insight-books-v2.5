import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    console.log('Delete subscription endpoint called');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { subscriptionId } = body;
    
    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      console.log('Admin authentication failed');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('Admin authenticated:', admin.email);

    console.log('Attempting to delete subscription with ID:', subscriptionId);

    // Check if subscription exists
    const subscription = await prisma.accountSubscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      console.log('Subscription not found:', subscriptionId);
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    console.log('Subscription found, proceeding with deletion:', subscriptionId);

    // Delete subscription
    await prisma.accountSubscription.delete({
      where: { id: subscriptionId }
    });

    console.log('Subscription deleted successfully:', subscriptionId);

    return NextResponse.json({
      success: true,
      message: 'Subscription deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete subscription: ' + error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
