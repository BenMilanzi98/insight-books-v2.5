import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { isInventoryLedgerAccount } from '@/lib/journalManualLineValidation';

function findCapitalAccountWhere(tenantId) {
  return {
    tenantId,
    isActive: true,
    AND: [
      {
        OR: [
          { accountType: 'Equity' },
          { accountType: 'EQUITY' },
          { type: 'Equity' },
          { type: 'EQUITY' },
        ],
      },
      {
        OR: [
          { accountName: { contains: 'Capital', mode: 'insensitive' } },
          { name: { contains: 'Capital', mode: 'insensitive' } },
        ],
      },
      { NOT: { accountCode: '3000' } },
    ],
  };
}

async function resolveOwnersCapitalAccount(tenantId) {
  const byCode = await prisma.account.findFirst({
    where: { tenantId, isActive: true, accountCode: '3100' },
  });
  if (byCode) return byCode;
  return prisma.account.findFirst({
    where: findCapitalAccountWhere(tenantId),
  });
}

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

    const capitalAccount = await resolveOwnersCapitalAccount(user.tenantId);

    if (!capitalAccount) {
      return NextResponse.json({
        contributions: [],
        summary: {
          totalCashContributions: 0,
          totalAssetContributions: 0,
          totalCapital: 0,
        },
      });
    }

    const creditEntries = await prisma.journalEntry.findMany({
      where: {
        accountId: capitalAccount.id,
        credit: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (creditEntries.length === 0) {
      return NextResponse.json({
        contributions: [],
        summary: {
          totalCashContributions: 0,
          totalAssetContributions: 0,
          totalCapital: capitalAccount.balance || 0,
        },
      });
    }

    const transactionIds = [
      ...new Set(creditEntries.map((e) => e.transactionId).filter(Boolean)),
    ];

    const [transactions, debitEntries] = await Promise.all([
      prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
      }),
      prisma.journalEntry.findMany({
        where: {
          transactionId: { in: transactionIds },
          debit: { gt: 0 },
        },
      }),
    ]);

    const debitAccountIds = [
      ...new Set(debitEntries.map((e) => e.accountId).filter(Boolean)),
    ];
    const debitAccounts = await prisma.account.findMany({
      where: { id: { in: debitAccountIds } },
    });

    const txMap = Object.fromEntries(transactions.map((t) => [t.id, t]));
    const debitMap = {};
    for (const de of debitEntries) {
      if (!debitMap[de.transactionId]) {
        debitMap[de.transactionId] = de;
      }
    }
    const acctMap = Object.fromEntries(debitAccounts.map((a) => [a.id, a]));

    let totalCash = 0;
    let totalAsset = 0;

    const contributions = creditEntries.map((entry) => {
      const tx = txMap[entry.transactionId] || {};
      const debit = debitMap[entry.transactionId];
      const debitAccount = debit ? acctMap[debit.accountId] : null;

      const debitAccountName =
        debitAccount?.name || debitAccount?.accountName || 'Unknown';
      const debitType = (debitAccount?.type || debitAccount?.accountType || '')
        .toUpperCase();
      const nameLower = debitAccountName.toLowerCase();

      const isCash =
        nameLower.includes('cash') ||
        nameLower.includes('bank') ||
        nameLower.includes('checking') ||
        nameLower.includes('savings');
      const type = isCash ? 'cash' : 'asset';

      const amount = entry.credit || 0;
      if (type === 'cash') {
        totalCash += amount;
      } else {
        totalAsset += amount;
      }

      return {
        id: entry.id,
        date: tx.date || entry.entryDate || entry.createdAt,
        amount,
        type,
        description: tx.description || entry.description || '',
        reference: tx.reference || entry.referenceNumber || '',
        debitAccountName,
        createdAt: entry.createdAt,
      };
    });

    return NextResponse.json({
      contributions,
      summary: {
        totalCashContributions: totalCash,
        totalAssetContributions: totalAsset,
        totalCapital: capitalAccount.balance || 0,
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

    let capitalAccount = await resolveOwnersCapitalAccount(user.tenantId);

    if (!capitalAccount) {
      capitalAccount = await prisma.account.create({
        data: {
          code: '3100',
          accountCode: '3100',
          name: "Owner's Capital",
          accountName: "Owner's Capital",
          type: 'EQUITY',
          accountType: 'Equity',
          normalBalance: 'Credit',
          balance: 0,
          isActive: true,
          tenantId: user.tenantId,
        },
      });
    }

    const capitalType = (
      capitalAccount.type ||
      capitalAccount.accountType ||
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
      if (cashAccountId) {
        debitAccount = await prisma.account.findFirst({
          where: { id: cashAccountId, tenantId: user.tenantId, isActive: true },
        });
        if (!debitAccount) {
          return NextResponse.json(
            { error: 'Specified cash account not found' },
            { status: 404 }
          );
        }
      }

      if (!debitAccount) {
        debitAccount = await prisma.account.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true,
            type: 'ASSET',
            OR: [
              { name: { contains: 'Cash', mode: 'insensitive' } },
              { name: { contains: 'Bank', mode: 'insensitive' } },
              { name: { contains: 'Checking', mode: 'insensitive' } },
              { name: { contains: 'Savings', mode: 'insensitive' } },
              { code: { startsWith: '1000' } },
              { code: { startsWith: '1100' } },
            ],
          },
        });
      }

      if (!debitAccount) {
        debitAccount = await prisma.account.create({
          data: {
            code: '1000',
            name: 'Cash',
            type: 'ASSET',
            balance: 0,
            isActive: true,
            tenantId: user.tenantId,
          },
        });
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

    const transaction = await prisma.transaction.create({
      data: {
        date: entryDate,
        description: txDescription,
        reference,
        status: 'posted',
        tenantId: user.tenantId,
        createdById: user.id,
        entryType: 'Regular',
        sourceType: 'capital_contribution',
      },
    });

    const [debitEntry, creditEntry] = await prisma.$transaction([
      prisma.journalEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: debitAccount.id,
          debit: parsedAmount,
          credit: 0,
          description: txDescription,
          status: 'posted',
          entryDate,
          tenantId: user.tenantId,
          createdById: user.id,
          sourceType: 'capital_contribution',
          sourceId: transaction.id,
        },
      }),
      prisma.journalEntry.create({
        data: {
          transactionId: transaction.id,
          accountId: capitalAccount.id,
          debit: 0,
          credit: parsedAmount,
          description: txDescription,
          status: 'posted',
          entryDate,
          tenantId: user.tenantId,
          createdById: user.id,
          sourceType: 'capital_contribution',
          sourceId: transaction.id,
        },
      }),
    ]);

    const newDebitBalance = (debitAccount.balance || 0) + parsedAmount;
    const newCapitalBalance = (capitalAccount.balance || 0) + parsedAmount;

    await prisma.$transaction([
      prisma.account.update({
        where: { id: debitAccount.id },
        data: { balance: newDebitBalance },
      }),
      prisma.account.update({
        where: { id: capitalAccount.id },
        data: { balance: newCapitalBalance },
      }),
      prisma.accountBalance.upsert({
        where: {
          tenantId_account: {
            tenantId: user.tenantId,
            account: debitAccount.id,
          },
        },
        update: { balance: newDebitBalance },
        create: {
          tenantId: user.tenantId,
          account: debitAccount.id,
          balance: newDebitBalance,
        },
      }),
      prisma.accountBalance.upsert({
        where: {
          tenantId_account: {
            tenantId: user.tenantId,
            account: capitalAccount.id,
          },
        },
        update: { balance: newCapitalBalance },
        create: {
          tenantId: user.tenantId,
          account: capitalAccount.id,
          balance: newCapitalBalance,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: 'CAPITAL_CONTRIBUTION',
        entityType: 'ACCOUNT',
        entityId: capitalAccount.id,
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
          capitalAccountId: capitalAccount.id,
          capitalAccountName: capitalAccount.name || capitalAccount.accountName,
          transactionId: transaction.id,
          debitEntryId: debitEntry.id,
          creditEntryId: creditEntry.id,
          assetName: assetName || null,
          assetType: assetType || null,
        }),
      },
    });

    return NextResponse.json(
      {
        message: 'Capital contribution recorded successfully',
        contribution: {
          id: creditEntry.id,
          date: entryDate,
          amount: parsedAmount,
          type,
          description: txDescription,
          reference,
          debitAccountName: debitAccount.name || debitAccount.accountName,
          transactionId: transaction.id,
          capitalAccount: {
            id: capitalAccount.id,
            name: capitalAccount.name || capitalAccount.accountName,
            newBalance: newCapitalBalance,
          },
          debitAccount: {
            id: debitAccount.id,
            name: debitAccount.name || debitAccount.accountName,
            newBalance: newDebitBalance,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.message?.includes('period') || error.message?.includes('closed')) {
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
