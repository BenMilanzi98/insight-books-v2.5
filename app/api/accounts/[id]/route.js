// app/api/accounts/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// GET - Fetch a specific account by ID
export async function GET(request, { params }) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    const accountId = params.id;
    
    // Get the account
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId: tenantId
      }
    });
    
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(account);
  } catch (error) {
    console.error(`Error fetching account ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch account. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update an account
export async function PUT(request, { params }) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    const accountId = params.id;
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.type) {
      return NextResponse.json(
        { error: 'Invalid request. Missing required fields.' },
        { status: 400 }
      );
    }
    
    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId: tenantId
      }
    });
    
    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    
    // Update account
    const account = await prisma.account.update({
      where: {
        id: accountId
      },
      data: {
        name: body.name,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'ACCOUNT_UPDATED',
        entityType: 'ACCOUNT',
        entityId: account.id,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          accountId: account.id,
          code: account.code,
          name: account.name,
          type: account.type
        })
      }
    });
    
    return NextResponse.json({
      message: 'Account updated successfully',
      account
    });
  } catch (error) {
    console.error(`Error updating account ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to update account. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an account
export async function DELETE(request, { params }) {
  try {
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    const accountId = params.id;
    
    // Check if account exists
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: accountId,
        tenantId: tenantId
      }
    });
    
    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    
    // Check if account is used in any journal entries
    const journalEntriesCount = await prisma.journalEntry.count({
      where: {
        accountId: accountId
      }
    });
    
    if (journalEntriesCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete account because it is used in journal entries' },
        { status: 400 }
      );
    }

    if (existingAccount.mergedIntoAccountId) {
      return NextResponse.json(
        {
          error:
            'Cannot delete a merged source account. It remains in the database for auditing; only the surviving account is shown in lists.',
        },
        { status: 400 }
      );
    }

    const mergedIntoThis = await prisma.account.count({
      where: { mergedIntoAccountId: accountId, tenantId },
    });
    if (mergedIntoThis > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete an account that other accounts have been merged into. Merge sources are kept for audit.',
        },
        { status: 400 }
      );
    }

    // Delete account
    await prisma.account.delete({
      where: {
        id: accountId
      }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'ACCOUNT_DELETED',
        entityType: 'ACCOUNT',
        entityId: accountId,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          accountId: accountId,
          code: existingAccount.code,
          name: existingAccount.name,
          type: existingAccount.type
        })
      }
    });
    
    return NextResponse.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting account ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}