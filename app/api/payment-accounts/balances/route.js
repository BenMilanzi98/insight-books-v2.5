import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Get balances for all payment accounts
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get all active payment accounts
    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' }
      ]
    });

    // Get all account balances
    const accountBalances = await prisma.accountBalance.findMany({
      where: { tenantId: user.tenantId }
    });

    // Helper to normalize payment method names for matching
    const normalizeName = (name) => {
      if (!name) return '';
      return name.toLowerCase().trim().replace(/\s+/g, '_');
    };

    // Create a map of normalized names to balances
    const balancesMap = new Map();
    accountBalances.forEach(b => {
      const normalized = normalizeName(b.account);
      const currentBalance = balancesMap.get(normalized) || 0;
      balancesMap.set(normalized, currentBalance + (parseFloat(b.balance) || 0));
    });

    // Map payment accounts to their balances
    const accountsWithBalances = paymentAccounts.map(account => {
      // Try multiple normalization strategies
      const accountName = account.name.toLowerCase().trim();
      const normalized = normalizeName(account.name);
      
      // Try exact match first
      let balance = balancesMap.get(accountName) || balancesMap.get(normalized) || 0;
      
      // If still 0, try variations
      if (balance === 0) {
        // Try without underscores
        const noSpaces = accountName.replace(/\s+/g, '');
        balance = balancesMap.get(noSpaces) || 0;
      }
      
      return {
        id: account.id,
        name: account.name,
        accountType: account.accountType,
        reference: account.reference,
        isSystem: account.isSystem,
        isActive: account.isActive,
        balance: balance
      };
    });

    return NextResponse.json({ 
      success: true, 
      accounts: accountsWithBalances 
    });
  } catch (error) {
    console.error('Error fetching payment account balances:', error);
    return NextResponse.json({ error: 'Failed to fetch payment account balances' }, { status: 500 });
  }
}

