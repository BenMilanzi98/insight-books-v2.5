// app/api/assets/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getPaymentAccount } from '@/lib/transactionJournalHelpers';
import { generateReferenceNumber } from '@/lib/journalService';
import { updateAccountBalance } from '@/lib/core';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { assertAccountInSubtree } from '@/lib/coaGlSubtreeValidation.js';

/**
 * GET handler for assets
 * Fetches all assets with filtering, sorting, and pagination
 */
export async function GET(request) {
  try {
    // Check for standard access (trial or paid subscription)
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'purchaseDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const isExistingAsset = searchParams.get('isExistingAsset');
    const source = searchParams.get('source');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId
    };
    
    // Add category filter if provided
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add existing asset filter if provided
    if (isExistingAsset !== null && isExistingAsset !== undefined) {
      where.isExistingAsset = isExistingAsset === 'true';
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Source filter: assets auto-created from PO/Receipt flow.
    if (source === 'po') {
      const poMarkerFilter = {
        OR: [
          { notes: { contains: 'AUTO_ASSET_FROM_GR:', mode: 'insensitive' } },
          { notes: { contains: '[PO_ASSET:', mode: 'insensitive' } }
        ]
      };
      if (where.OR) {
        where.AND = [{ OR: where.OR }, poMarkerFilter];
        delete where.OR;
      } else {
        Object.assign(where, poMarkerFilter);
      }
    }

    if (source === 'capital') {
      const capitalMarkerFilter = {
        notes: { contains: 'CAPITAL_CONTRIBUTION:', mode: 'insensitive' },
      };
      if (where.OR) {
        where.AND = [{ OR: where.OR }, capitalMarkerFilter];
        delete where.OR;
      } else {
        Object.assign(where, capitalMarkerFilter);
      }
    }
    
    // Get total count
    const totalCount = await prisma.asset.count({
      where
    });

    const unallocatedGlCount = await prisma.asset.count({
      where: { ...where, glAccountId: null },
    });
    
    // Fetch assets with category information
    const assets = await prisma.asset.findMany({
      where,
      include: {
        category: true,
        glAccount: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        depreciationSchedules: {
          orderBy: {
            periodStart: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take: limit
    });
    
    // Calculate current values for each asset
    const assetsWithValues = assets.map(asset => {
      const latestDepreciation = asset.depreciationSchedules[0];
      const currentAccumulatedDepreciation = latestDepreciation?.accumulatedDepreciation || asset.accumulatedDepreciation;
      const currentNetBookValue = asset.originalCost - currentAccumulatedDepreciation;
      
      return {
        ...asset,
        currentAccumulatedDepreciation,
        currentNetBookValue
      };
    });
    
    return NextResponse.json({
      assets: assetsWithValues,
      unallocatedGlCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch assets. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for creating a new asset
 */
export async function POST(request) {
  try {
    // Test Prisma client
    console.log('Testing Prisma client...');
    const testCount = await prisma.asset.count();
    console.log('Prisma client working. Asset count:', testCount);
    
    // Authenticate user and get tenant ID
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated with this user' },
        { status: 401 }
      );
    }
    
    const tenantId = user.tenantId;
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.purchaseDate || !body.originalCost || !body.usefulLifeYears) {
      return NextResponse.json(
        { error: 'Invalid request. Missing required fields.' },
        { status: 400 }
      );
    }

    let categoryId = body.categoryId;
    if (!categoryId && body.newCategoryName?.trim()) {
      const categoryName = body.newCategoryName.trim();
      let category = await prisma.assetCategory.findFirst({
        where: { tenantId, name: { equals: categoryName, mode: 'insensitive' } },
      });
      if (!category) {
        category = await prisma.assetCategory.create({
          data: {
            tenantId,
            name: categoryName,
            description: body.newCategoryDescription?.trim() || null,
          },
        });
      }
      categoryId = category.id;
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category is required. Select a category or provide a new category name.' },
        { status: 400 }
      );
    }
    
    // Validate paymentMethod is provided for new assets (not existing)
    const isExistingAsset = body.isExistingAsset || false;
    if (!isExistingAsset && !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Payment account is required for new asset purchases.' },
        { status: 400 }
      );
    }
    
    // Verify category exists
    const category = await prisma.assetCategory.findFirst({
      where: {
        id: categoryId,
        tenantId: tenantId
      }
    });
    
    if (!category) {
      return NextResponse.json(
        { error: 'Invalid asset category' },
        { status: 400 }
      );
    }

    if (!body.glAccountId) {
      return NextResponse.json(
        { error: 'Fixed asset GL account (under 1500) is required.' },
        { status: 400 }
      );
    }
    try {
      await assertAccountInSubtree(prisma, tenantId, body.glAccountId, '1500');
    } catch (glErr) {
      return NextResponse.json(
        { error: glErr.message || 'Invalid fixed asset GL account' },
        { status: 400 }
      );
    }
    
    // Resolve payment method to account ID if provided
    let paymentAccountId = null;
    let paymentMethodKey = null;
    if (!isExistingAsset && body.paymentMethod) {
      try {
        paymentMethodKey = body.paymentMethod;
        const paymentAccount = await getPaymentAccount(tenantId, body.paymentMethod);
        if (!paymentAccount) {
          return NextResponse.json(
            { error: 'Invalid payment account. Please check your payment processing configuration.' },
            { status: 400 }
          );
        }
        paymentAccountId = paymentAccount.id;
      } catch (error) {
        console.error('Error resolving payment account:', error);
        return NextResponse.json(
          { error: 'Failed to resolve payment account. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    // Create asset in database
    console.log('Creating asset with data:', {
      name: body.name,
      categoryId: body.categoryId,
      tenantId: tenantId,
      createdById: user.id
    });
    
    const asset = await prisma.asset.create({
      data: {
        name: body.name,
        description: body.description,
        categoryId: categoryId,
        purchaseDate: new Date(body.purchaseDate),
        originalCost: parseFloat(body.originalCost) || 0,
        usefulLifeYears: parseInt(body.usefulLifeYears) || 1,
        depreciationMethod: body.depreciationMethod || 'straight_line',
        status: body.status || 'active',
        location: body.location,
        serialNumber: body.serialNumber,
        supplier: body.supplier,
        warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null,
        notes: body.notes,
        isExistingAsset: body.isExistingAsset || false,
        accumulatedDepreciation: parseFloat(body.accumulatedDepreciation) || 0,
        tenantId: tenantId,
        createdById: user.id,
        glAccountId: body.glAccountId,
      },
      include: {
        category: true,
        glAccount: {
          select: { id: true, accountCode: true, accountName: true },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    // Create journal entry for asset purchase (only for new assets, not existing ones)
    if (!isExistingAsset) {
      await createAssetJournalEntry(asset, 'purchase', tenantId, user.id, paymentAccountId, paymentMethodKey);
      
      // Create Payment record for payment processing view
      await prisma.payment.create({
        data: {
          amount: asset.originalCost,
          paymentDate: new Date(asset.purchaseDate),
          paymentMethod: paymentMethodKey,
          type: 'asset',
          sourceAccount: paymentMethodKey,
          reference: `Asset Purchase - ${asset.name}`,
          notes: `Purchase of ${asset.name} (${category.name})`,
          status: 'Completed',
          tenantId: tenantId
        }
      });
    } else {
      // Owner-contributed / pre-existing asset: Dr Asset, Cr Owner's Equity
      await createAssetJournalEntry(asset, 'purchase', tenantId, user.id, null, null);
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'ASSET_CREATED',
        entityType: 'ASSET',
        entityId: asset.id,
        userId: user.id,
        tenantId: tenantId,
        details: JSON.stringify({
          assetId: asset.id,
          name: asset.name,
          category: category.name,
          originalCost: asset.originalCost,
          isExistingAsset: asset.isExistingAsset
        })
      }
    });
    
    return NextResponse.json({
      message: 'Asset created successfully',
      asset
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating asset:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json(
      { error: `Failed to create asset: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Helper function to create journal entry for asset
 */
async function createAssetJournalEntry(asset, entryType, tenantId, userId, paymentAccountId = null, paymentMethodKey = null) {
  try {
    console.log('Creating asset journal entry:', { assetId: asset.id, entryType, paymentAccountId, paymentMethodKey });
    
    let assetAccount = null;
    if (asset.glAccountId) {
      assetAccount = await prisma.account.findFirst({
        where: {
          id: asset.glAccountId,
          tenantId,
          accountType: 'Asset',
          isActive: true,
        },
      });
      if (!assetAccount) {
        throw new Error('Selected fixed asset GL account is missing or inactive');
      }
    } else {
      // Legacy: category-named auto account (no glAccountId — pre-migration rows only)
      assetAccount = await prisma.account.findFirst({
        where: {
          tenantId: tenantId,
          accountName: { contains: asset.category.name, mode: 'insensitive' },
          accountType: 'Asset',
          isActive: true
        }
      });

      if (!assetAccount) {
        assetAccount = await prisma.account.findFirst({
          where: {
            tenantId: tenantId,
            name: { contains: asset.category.name, mode: 'insensitive' },
            type: 'ASSET',
            isActive: true
          }
        });
      }

      if (!assetAccount) {
        const accountCode = generateAssetAccountCode(asset.category.name);
        assetAccount = await prisma.account.create({
          data: {
            accountCode: accountCode,
            accountName: `${asset.category.name} Assets`,
            accountType: 'Asset',
            accountSubtype: 'fixed',
            normalBalance: 'Debit',
            isActive: true,
            tenantId: tenantId
          }
        });
        console.log('Created asset account:', assetAccount.id);
      }
    }
    
    // Get or create accumulated depreciation account
    let accumulatedDepreciationAccount = await prisma.account.findFirst({
      where: {
        tenantId: tenantId,
        accountName: { contains: 'Accumulated Depreciation', mode: 'insensitive' },
        accountType: 'Asset',
        isActive: true
      }
    });
    
    if (!accumulatedDepreciationAccount) {
      accumulatedDepreciationAccount = await prisma.account.findFirst({
        where: {
          tenantId: tenantId,
          name: { contains: 'Accumulated Depreciation', mode: 'insensitive' },
          type: 'ASSET',
          isActive: true
        }
      });
    }
    
    if (!accumulatedDepreciationAccount) {
      const depCode = generateAccumulatedDepreciationCode();
      accumulatedDepreciationAccount = await prisma.account.create({
        data: {
          accountCode: depCode,
          accountName: 'Accumulated Depreciation',
          accountType: 'Asset',
          accountSubtype: 'depreciation',
          normalBalance: 'Credit',
          isActive: true,
          tenantId: tenantId
        }
      });
      console.log('Created accumulated depreciation account:', accumulatedDepreciationAccount.id);
    }
    
    // Get or create Owner's Capital equity account
    let ownersCapitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: tenantId,
        accountName: { contains: "Owner's Capital", mode: 'insensitive' },
        accountType: 'Equity',
        isActive: true
      }
    });
    
    if (!ownersCapitalAccount) {
      ownersCapitalAccount = await prisma.account.findFirst({
        where: {
          tenantId: tenantId,
          name: { contains: "Owner's Capital", mode: 'insensitive' },
          type: 'EQUITY',
          isActive: true
        }
      });
    }
    
    if (!ownersCapitalAccount) {
      ownersCapitalAccount = await prisma.account.create({
        data: {
          accountCode: '3100',
          accountName: "Owner's Capital",
          accountType: 'Equity',
          normalBalance: 'Credit',
          isActive: true,
          tenantId: tenantId
        }
      });
    }
    
    if (entryType === 'purchase') {
      if (asset.isExistingAsset) {
        // For existing assets, create opening balance entry
        const purchaseDate = asset.purchaseDate instanceof Date ? asset.purchaseDate : new Date(asset.purchaseDate);
        const referenceNumber = await generateReferenceNumber(prisma, tenantId, purchaseDate);
        
        await createTransactionWithEntries([
          {
            accountId: assetAccount.id,
            debitAmount: asset.originalCost,
            creditAmount: 0,
            description: `Owner contribution — ${asset.name}`
          },
          {
            accountId: ownersCapitalAccount.id,
            debitAmount: 0,
            creditAmount: asset.originalCost,
            description: `Owner's Capital — ${asset.name}`
          }
        ], `Owner Contribution — ${asset.name}`, tenantId, userId, purchaseDate, referenceNumber);
        
        // If there's accumulated depreciation, create that entry too
        if (asset.accumulatedDepreciation > 0) {
          const depReferenceNumber = await generateReferenceNumber(prisma, tenantId, purchaseDate);
          await createTransactionWithEntries([
            {
              accountId: ownersCapitalAccount.id,
              debitAmount: asset.accumulatedDepreciation,
              creditAmount: 0,
              description: `Opening balance - Accumulated Depreciation for ${asset.name}`
            },
            {
              accountId: accumulatedDepreciationAccount.id,
              debitAmount: 0,
              creditAmount: asset.accumulatedDepreciation,
              description: `Opening balance - Accumulated Depreciation for ${asset.name}`
            }
          ], `Opening Balance - Accumulated Depreciation - ${asset.name}`, tenantId, userId, purchaseDate, depReferenceNumber);
        }
      } else {
        // For new assets, create purchase entry
        // Debit the asset account and credit the payment account
        if (!paymentAccountId) {
          throw new Error('Payment account ID is required for new asset purchases');
        }
        
        const paymentAccount = await prisma.account.findFirst({
          where: {
            id: paymentAccountId,
            tenantId: tenantId
          }
        });
        
        if (!paymentAccount) {
          throw new Error('Payment account not found');
        }
        
        const purchaseDate = asset.purchaseDate instanceof Date ? asset.purchaseDate : new Date(asset.purchaseDate);
        const referenceNumber = await generateReferenceNumber(prisma, tenantId, purchaseDate);
        
        console.log('Creating transaction for asset purchase:', {
          assetName: asset.name,
          amount: asset.originalCost,
          assetAccountId: assetAccount.id,
          paymentAccountId: paymentAccount.id,
          referenceNumber
        });
        
        const transaction = await createTransactionWithEntries([
          {
            accountId: assetAccount.id,
            debitAmount: asset.originalCost,
            creditAmount: 0,
            description: `Purchase of ${asset.name}`
          },
          {
            accountId: paymentAccount.id,
            debitAmount: 0,
            creditAmount: asset.originalCost,
            description: `Purchase of ${asset.name}`
          }
        ], `Asset Purchase - ${asset.name}`, tenantId, userId, purchaseDate, referenceNumber);
        
        console.log('Transaction created:', transaction.id);
        
      // Update payment method balance
      if (paymentMethodKey) {
        console.log('Asset GL posted via createAssetGlTransaction; balance updated on CoA accounts.');
      }
      }
    }
    
    // Record the journal entry in asset journal entries
    await prisma.assetJournalEntry.create({
      data: {
        assetId: asset.id,
        entryType: entryType,
        amount: asset.originalCost,
        description: `${entryType} - ${asset.name}`
      }
    });
    
  } catch (error) {
    console.error('Error creating asset journal entry:', error);
    console.error('Error stack:', error.stack);
    // Re-throw error so we can see what's wrong
    throw error;
  }
}

/**
 * Helper function to create transaction with journal entries
 */
async function createTransactionWithEntries(entries, description, tenantId, userId = null, entryDate = null, referenceNumber = null) {
  // Validate entries
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw new Error('Transaction entries are required');
  }

  if (entries.length < 2) {
    throw new Error('Transaction must have at least 2 lines (double-entry requirement)');
  }

  // Validate balance
  const totalDebits = entries.reduce((sum, entry) => sum + parseFloat(entry.debitAmount || 0), 0);
  const totalCredits = entries.reduce((sum, entry) => sum + parseFloat(entry.creditAmount || 0), 0);
  const difference = Math.abs(totalDebits - totalCredits);
  
  if (difference > 0.01) {
    throw new Error(`Transaction does not balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${difference.toFixed(2)}`);
  }

  const transactionDate = entryDate || new Date();
  await assertPeriodOpen(tenantId, transactionDate, prisma);
  const refNumber = referenceNumber || await generateReferenceNumber(prisma, tenantId, transactionDate);
  
  const transaction = await prisma.transaction.create({
    data: {
      date: transactionDate,
      description: description,
      reference: refNumber,
      status: 'posted',
      entryType: 'Regular',
      sourceType: 'Asset',
      tenantId: tenantId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: entries.map((entry, index) => ({
          lineNumber: index + 1,
          accountId: entry.accountId,
          debitAmount: entry.debitAmount || 0,
          creditAmount: entry.creditAmount || 0,
          description: entry.description
        }))
      }
    },
    include: {
      lines: true // Include lines to verify they were created
    }
  });

  // Verify lines were created
  if (!transaction.lines || transaction.lines.length === 0) {
    // If lines weren't created, delete the transaction and throw error
    await prisma.transaction.delete({
      where: { id: transaction.id }
    });
    throw new Error('Failed to create transaction lines. Transaction was not created.');
  }

  if (transaction.lines.length !== entries.length) {
    // If not all lines were created, delete the transaction and throw error
    await prisma.transaction.delete({
      where: { id: transaction.id }
    });
    throw new Error(`Failed to create all transaction lines. Expected ${entries.length}, got ${transaction.lines.length}.`);
  }
  
  return transaction;
}

/**
 * Helper function to generate asset account code
 */
function generateAssetAccountCode(categoryName) {
  const categoryCodes = {
    'Equipment': '1500',
    'Vehicle': '1600',
    'Furniture': '1700',
    'Computer': '1800',
    'Machinery': '1900'
  };
  
  return categoryCodes[categoryName] || '1500';
}

/**
 * Helper function to generate accumulated depreciation account code
 */
function generateAccumulatedDepreciationCode() {
  return '1501';
}

