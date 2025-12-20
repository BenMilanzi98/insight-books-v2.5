import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// GET - Fetch all backups
export async function GET(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    // Get backups data
    const backups = await getBackupsData();

    return NextResponse.json({
      success: true,
      backups
    });

  } catch (error) {
    console.error('Admin backups error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch backups data' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Create new backup
export async function POST(request) {
  try {
    // Verify admin authentication
    const token = request.cookies.get('admin_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 403 }
      );
    }

    if (!decoded.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Insufficient privileges' },
        { status: 403 }
      );
    }

    const { type = 'full', description = '' } = await request.json();

    // Create backup (in a real implementation, this would actually create a database backup)
    const backup = await createBackup(type, description, decoded.adminId);

    return NextResponse.json({
      success: true,
      backup,
      message: 'Backup created successfully'
    });

  } catch (error) {
    console.error('Admin backup creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create backup' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function getBackupsData() {
  try {
    // In a real implementation, this would fetch actual backup files from storage
    // For now, we'll return mock data
    const mockBackups = [
      {
        id: 'backup-001',
        name: 'Daily Backup - 2025-01-15',
        type: 'full',
        description: 'Automated daily backup',
        status: 'completed',
        fileSize: 1024 * 1024 * 50, // 50MB
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5 * 60 * 1000), // 5 minutes later
        createdBy: 'System'
      },
      {
        id: 'backup-002',
        name: 'Weekly Backup - 2025-01-12',
        type: 'full',
        description: 'Weekly system backup',
        status: 'completed',
        fileSize: 1024 * 1024 * 45, // 45MB
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000), // 8 minutes later
        createdBy: 'System'
      },
      {
        id: 'backup-003',
        name: 'Manual Backup - 2025-01-10',
        type: 'incremental',
        description: 'Pre-deployment backup',
        status: 'completed',
        fileSize: 1024 * 1024 * 15, // 15MB
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000), // 3 minutes later
        createdBy: 'admin@insightbooksafrica.com'
      },
      {
        id: 'backup-004',
        name: 'Monthly Backup - 2025-01-01',
        type: 'full',
        description: 'Monthly system backup',
        status: 'completed',
        fileSize: 1024 * 1024 * 60, // 60MB
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000), // 10 minutes later
        createdBy: 'System'
      }
    ];

    return mockBackups;

  } catch (error) {
    console.error('Error getting backups data:', error);
    return [];
  }
}

async function createBackup(type, description, adminId) {
  try {
    // In a real implementation, this would:
    // 1. Create an actual database backup using pg_dump or similar
    // 2. Store the backup file in cloud storage (S3, etc.)
    // 3. Record the backup metadata in the database
    
    const backupId = `backup-${Date.now()}`;
    const backup = {
      id: backupId,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Backup - ${new Date().toISOString().split('T')[0]}`,
      type,
      description,
      status: 'running',
      fileSize: 0,
      createdAt: new Date(),
      createdBy: adminId
    };

    // Simulate backup process
    setTimeout(() => {
      // In a real implementation, this would update the backup status
      console.log(`Backup ${backupId} completed`);
    }, 5000);

    return backup;

  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
} 