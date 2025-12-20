import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // For now, return mock session data since we don't have a sessions table
    // You can extend this to fetch from a UserSession or similar table
    const mockSessions = [
      {
        id: '1',
        userId: 'user1',
        userName: 'John Doe',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        lastActivity: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Jane Smith',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        lastActivity: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
      }
    ];

    return NextResponse.json({
      success: true,
      sessions: mockSessions,
      total: mockSessions.length
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 