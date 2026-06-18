import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { isInventoryLedgerAccount } from '@/lib/journalManualLineValidation';
import { resolvePrimaryCapitalAccount } from '@/lib/resolveCapitalAccount';
import {
  ensureCapitalParentAccount,
  createContributionSubAccount,
  listCapitalContributionAccountIds,
  resolveContributionCashDebitAccount,
  OWNERS_CAPITAL_GL_CODE,
  OWNERS_CAPITAL_GL_NAME,
} from '@/lib/capitalCoaHelpers';
import { registerAssetFromCapitalContribution } from '@/lib/capitalContributionAssetRegister';
import { postGlEntry, AccountingEngineError } from '@/lib/accountingEngine';
import { fetchCapitalContributions } from '@/lib/capitalContributionsQuery';
import { syncCapitalParentRollupBalance } from '@/lib/capitalCoaHelpers';

function isCoaAssetAccount(account) {
  if (!account) return false;
  const t = (account.accountType || account.type || '').toUpperCase();
  return t === 'ASSET' || t === 'ASSETS';
}

function generateReference(date) {
  const d = new Date(date);
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `CAP-${ymd}-${seq}`;
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const [settings, creditAccountIdsRaw, primaryCapital] = await Promise.all([
      prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
      listCapitalContributionAccountIds(user.tenantId, prisma),
      resolvePrimaryCapitalAccount(user.tenantId, prisma),
    ]);

    let creditAccountIds =
      creditAccountIdsRaw?.length > 0
        ? [...creditAccountIdsRaw]
        : primaryCapital
          ? [primaryCapital.id]
          : [];

    // Owner's Capital (3100): always include when present so historical credits still list alongside the primary pool row.
    const legacy3100 = await prisma.account.findFirst({
      where: { tenantId: user.tenantId, isActive: true, accountCode: '3100' },
      select: { id: true },
    });
    if (legacy3100?.id && !creditAccountIds.includes(legacy3100.id)) {
      creditAccountIds = [...creditAccountIds, legacy3100.id];
    }

    if (!creditAccountIds.length) {
      return NextResponse.json({
        contributions: [],
        summary: {
          totalCashContributions: 0,
          totalAssetContributions: 0,
          totalCapital: Number(settings?.ownerContributedCapital) || 0,
          ownerContributedCapital: Number(settings?.ownerContributedCapital) || 0,
        },
      });
    }

    const { contributions, totalCash, totalAsset } = await fetchCapitalContributions(
      user.tenantId,
      creditAccountIds,
      prisma
    );

    if (contributions.length === 0) {
      const contributed = Number(settings?.ownerContributedCapital) || 0;
      return NextResponse.json({
        contributions: [],
        summary: {
          totalCashContributions: 0,
          totalAssetContributions: 0,
          totalCapital: contributed || primaryCapital?.balance || 0,
          ownerContributedCapital: contributed,
        },
      });
    }

    const contributed = Number(settings?.ownerContributedCapital) || 0;
    const ledgerCapital = primaryCapital?.balance ?? 0;

    return NextResponse.json({
      contributions: contributions.map((c) => ({
        id: c.id,
        date: c.date,
        amount: c.amount,
        type: c.type,
        description: c.description || '',
        reference: c.reference || '',
        debitAccountName: c.debitAccountName,
        coaAccountCode: c.contributionAccountCode,
        createdAt: c.date,
      })),
      summary: {
        totalCashContributions: totalCash,
        totalAssetContributions: totalAsset,
        totalCapital: contributed > 0 ? contributed : ledgerCapital,
        ownerContributedCapital: contributed,
        ledgerCapitalBalance: ledgerCapital,
      },
    });
  } catch (error) {
    console.error('Error fetching capital contributions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capital contributions' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      type,
      amount,
      date,
      description,
      cashAccountId,
      assetName,
      assetType,
      assetAccountId,
    } = body;

    if (!type || !['cash', 'asset'].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'cash' or 'asset'" },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    const parentCapital = await ensureCapitalParentAccount(user.tenantId, prisma);
    const contributionLabel =
      (description && String(description).trim()) ||
      (type === 'cash' ? 'Cash contribution' : 'Asset contribution');
    const equityAccountForCredit = await createContributionSubAccount(
      user.tenantId,
      parentCapital,
      prisma,
      contributionLabel
    );

    const capitalType = (
      equityAccountForCredit.type ||
      equityAccountForCredit.accountType ||
      ''
    ).toUpperCase();
    if (capitalType !== 'EQUITY') {
      return NextResponse.json(
        { error: 'Credit side must be an Equity account' },
        { status: 400 }
      );
    }

    let debitAccount = null;

    if (type === 'cash') {
      debitAccount = await resolveContributionCashDebitAccount(
        user.tenantId,
        cashAccountId,
        prisma
      );

      if (!debitAccount) {
        return NextResponse.json(
          {
            error:
              'Could not resolve a cash GL account (1110). Sync chart of accounts or select a payment account.',
          },
          { status: 404 }
        );
      }
    } else {
      if (assetAccountId) {
        debitAccount = await prisma.account.findFirst({
          where: {
            id: assetAccountId,
            tenantId: user.tenantId,
            isActive: true,
          },
        });
        if (!debitAccount) {
          return NextResponse.json(
            { error: 'Specified asset account not found in chart of accounts' },
            { status: 404 }
          );
        }
      }

      if (!debitAccount && assetType) {
        const assetSearchTerms = [assetType];
        const assetTypeMap = {
          equipment: ['Equipment'],
          'motor vehicle': ['Motor Vehicle', 'Vehicle', 'Motor'],
          vehicle: ['Motor Vehicle', 'Vehicle'],
          furniture: ['Furniture', 'Fixtures', 'Furniture & Fixtures'],
          computer: ['Computer', 'IT Equipment', 'Computer Equipment'],
          machinery: ['Machinery', 'Plant & Machinery'],
          building: ['Building', 'Property'],
          land: ['Land'],
        };
        const mapped = assetTypeMap[assetType.toLowerCase()];
        if (mapped) {
          assetSearchTerms.push(...mapped);
        }

        debitAccount = await prisma.account.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true,
            OR: [
              { type: 'ASSET' },
              { accountType: 'Asset' },
              { accountType: 'ASSET' },
            ],
            AND: {
              OR: assetSearchTerms.map((term) => ({
                OR: [
                  { name: { contains: term, mode: 'insensitive' } },
                  { accountName: { contains: term, mode: 'insensitive' } },
                ],
              })),
            },
          },
        });
      }

      if (!debitAccount && assetName) {
        debitAccount = await prisma.account.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true,
            OR: [
              { type: 'ASSET' },
              { accountType: 'Asset' },
              { accountType: 'ASSET' },
            ],
            AND: {
              OR: [
                { name: { contains: assetName, mode: 'insensitive' } },
                { accountName: { contains: assetName, mode: 'insensitive' } },
              ],
            },
          },
        });
      }

      if (!debitAccount) {
        return NextResponse.json(
          {
            error:
              'Asset account not found. Please provide assetAccountId or ensure the asset account exists in your chart of accounts.',
          },
          { status: 404 }
        );
      }
    }

    if (!isCoaAssetAccount(debitAccount)) {
      return NextResponse.json(
        {
          error:
            'Capital contributions must debit an asset account (e.g. cash, bank, or equipment) from your chart of accounts.',
        },
        { status: 400 }
      );
    }
    if (isInventoryLedgerAccount(debitAccount)) {
      return NextResponse.json(
        {
          error:
            'Contributions cannot be posted to inventory accounts. Choose cash, bank, mobile money, or a fixed asset account.',
        },
        { status: 400 }
      );
    }

    const entryDate = new Date(date);
    await assertPeriodOpen(user.tenantId, entryDate, prisma);

    const reference = generateReference(date);
    const txDescription =
      description ||
      (type === 'cash'
        ? 'Cash capital contribution'
        : `Asset capital contribution - ${assetName || assetType || 'Asset'}`);

    const transaction = await postGlEntry({
      tenantId: user.tenantId,
      userId: user.id,
      entryDate,
      description: txDescription,
      reference,
      sourceType: 'capital_contribution',
      sourceId: reference,
      lines: [
        {
          accountId: debitAccount.id,
          debitAmount: parsedAmount,
          creditAmount: 0,
          description: txDescription,
        },
        {
          accountId: equityAccountForCredit.id,
          debitAmount: 0,
          creditAmount: parsedAmount,
          description: txDescription,
        },
      ],
    });

    const parentRollupBalance = await syncCapitalParentRollupBalance(
      user.tenantId,
      parentCapital.id,
      prisma
    );

    await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      create: {
        tenantId: user.tenantId,
        enabledModules: [],
        ownerContributedCapital: parsedAmount,
      },
      update: {
        ownerContributedCapital: { increment: parsedAmount },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CAPITAL_CONTRIBUTION',
        entityType: 'ACCOUNT',
        entityId: parentCapital.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          type,
          amount: parsedAmount,
          date: entryDate.toISOString(),
          reference,
          description: txDescription,
          debitAccountId: debitAccount.id,
          debitAccountName: debitAccount.name || debitAccount.accountName,
          capitalParentAccountId: parentCapital.id,
          contributionAccountId: equityAccountForCredit.id,
          contributionAccountCode: equityAccountForCredit.accountCode,
          capitalParentGlCode: OWNERS_CAPITAL_GL_CODE,
          transactionId: transaction.id,
          debitLineAccountId: debitAccount.id,
          creditLineAccountId: equityAccountForCredit.id,
          assetName: assetName || null,
          assetType: assetType || null,
        }),
      },
    });

    let registeredAsset = null;
    if (type === 'asset') {
      try {
        registeredAsset = await registerAssetFromCapitalContribution(
          {
            tenantId: user.tenantId,
            userId: user.id,
            transactionId: transaction.id,
            reference,
            assetName,
            assetType,
            debitAccount,
            amount: parsedAmount,
            purchaseDate: entryDate,
            description: txDescription,
          },
          prisma
        );
      } catch (registerErr) {
        console.error('Capital contribution asset register failed:', registerErr);
      }
    }

    const [refreshedDebit, refreshedCredit, refreshedParent] = await Promise.all([
      prisma.account.findUnique({
        where: { id: debitAccount.id },
        select: { id: true, balance: true, name: true, accountName: true },
      }),
      prisma.account.findUnique({
        where: { id: equityAccountForCredit.id },
        select: { id: true, balance: true, accountCode: true, name: true, accountName: true },
      }),
      prisma.account.findUnique({
        where: { id: parentCapital.id },
        select: { id: true, balance: true, name: true, accountName: true },
      }),
    ]);

    return NextResponse.json(
      {
        message: 'Capital contribution recorded successfully',
        contribution: {
          id: transaction.id,
          date: entryDate,
          amount: parsedAmount,
          type,
          description: txDescription,
          reference,
          debitAccountName: debitAccount.name || debitAccount.accountName,
          transactionId: transaction.id,
          coaAccountCode: equityAccountForCredit.accountCode,
          capitalParentGlCode: OWNERS_CAPITAL_GL_CODE,
          capitalParentGlName: OWNERS_CAPITAL_GL_NAME,
          capitalAccount: {
            id: parentCapital.id,
            name: refreshedParent?.name || refreshedParent?.accountName,
            newBalance: parentRollupBalance,
          },
          contributionAccount: {
            id: equityAccountForCredit.id,
            code: equityAccountForCredit.accountCode,
            name: equityAccountForCredit.accountName || equityAccountForCredit.name,
            newBalance: refreshedCredit?.balance ?? parsedAmount,
          },
          debitAccount: {
            id: debitAccount.id,
            name: refreshedDebit?.name || refreshedDebit?.accountName,
            newBalance: refreshedDebit?.balance,
          },
          registeredAsset: registeredAsset
            ? {
                id: registeredAsset.id,
                name: registeredAsset.name,
                category: registeredAsset.category?.name,
                glAccountId: registeredAsset.glAccountId,
              }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccountingEngineError || error.message?.includes('period') || error.message?.includes('closed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    console.error('Error creating capital contribution:', error);
    return NextResponse.json(
      { error: 'Failed to create capital contribution' },
      { status: 500 }
    );
  }
}
