// app/api/accounts/import/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import prisma from '@/lib/prisma';

/**
 * POST /api/accounts/import
 * Import accounts from JSON or CSV
 * Body: { accounts: [...], overwrite: false, skipDuplicates: true }
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accounts, overwrite = false, skipDuplicates = true } = body;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json(
        { error: 'Accounts array is required' },
        { status: 400 }
      );
    }

    // Validate account types
    const validTypes = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
    const validNormalBalances = ['Debit', 'Credit'];

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    await prisma.$transaction(async (tx) => {
      for (const accountData of accounts) {
        try {
          // Validate required fields
          if (!accountData.accountName) {
            results.errors.push({
              accountCode: accountData.accountCode || 'N/A',
              error: 'Account name is required',
            });
            continue;
          }

          if (!accountData.accountType || !validTypes.includes(accountData.accountType)) {
            results.errors.push({
              accountCode: accountData.accountCode || 'N/A',
              accountName: accountData.accountName,
              error: `Invalid account type: ${accountData.accountType}. Must be one of: ${validTypes.join(', ')}`,
            });
            continue;
          }

          // Set default normal balance if not provided
          let normalBalance = accountData.normalBalance;
          if (!normalBalance || !validNormalBalances.includes(normalBalance)) {
            // Auto-determine based on account type
            normalBalance = ['Asset', 'Expense'].includes(accountData.accountType) ? 'Debit' : 'Credit';
          }

          // Check if account exists
          const existing = await tx.account.findFirst({
            where: {
              tenantId: user.tenantId,
              OR: [
                accountData.accountCode ? { accountCode: accountData.accountCode } : {},
                { accountName: { equals: accountData.accountName, mode: 'insensitive' } },
              ].filter(obj => Object.keys(obj).length > 0),
            },
          });

          if (existing) {
            if (overwrite) {
              // Update existing account
              await tx.account.update({
                where: { id: existing.id },
                data: {
                  accountCode: accountData.accountCode || existing.accountCode,
                  accountName: accountData.accountName,
                  accountType: accountData.accountType,
                  normalBalance,
                  description: accountData.description || existing.description,
                  isActive: accountData.isActive !== undefined ? accountData.isActive : existing.isActive,
                },
              });
              results.updated++;
            } else if (skipDuplicates) {
              results.skipped++;
            } else {
              results.errors.push({
                accountCode: accountData.accountCode || 'N/A',
                accountName: accountData.accountName,
                error: 'Account already exists and overwrite is disabled',
              });
            }
            continue;
          }

          // Handle parent account if specified
          let parentAccountId = null;
          if (accountData.parentAccountCode || accountData.parentAccountName) {
            const parentAccount = await tx.account.findFirst({
              where: {
                tenantId: user.tenantId,
                OR: [
                  accountData.parentAccountCode ? { accountCode: accountData.parentAccountCode } : {},
                  accountData.parentAccountName ? { accountName: { equals: accountData.parentAccountName, mode: 'insensitive' } } : {},
                ].filter(obj => Object.keys(obj).length > 0),
              },
            });

            if (parentAccount) {
              parentAccountId = parentAccount.id;
            }
          }

          // Create new account
          await tx.account.create({
            data: {
              tenantId: user.tenantId,
              accountCode: accountData.accountCode || null,
              accountName: accountData.accountName,
              accountType: accountData.accountType,
              normalBalance,
              description: accountData.description || null,
              isActive: accountData.isActive !== undefined ? accountData.isActive : true,
              balance: accountData.balance || 0,
              parentAccountId,
            },
          });

          results.created++;
        } catch (error) {
          results.errors.push({
            accountCode: accountData.accountCode || 'N/A',
            accountName: accountData.accountName || 'N/A',
            error: error.message,
          });
        }
      }
    });

    return NextResponse.json({
      message: `Import completed. Created: ${results.created}, Updated: ${results.updated}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`,
      results,
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing accounts:', error);
    return NextResponse.json(
      { error: 'Failed to import accounts', details: error.message },
      { status: 500 }
    );
  }
}










