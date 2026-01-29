// app/api/account-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch payment accounts for the tenant
    const paymentAccounts = await prisma.paymentAccount.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true
      }
    });

    // Fetch account balances for the current tenant
    const balances = await prisma.accountBalance.findMany({
      where: { tenantId: user.tenantId },
      select: {
        account: true,
        balance: true
      }
    });

    // Helper to normalize account names for matching
    const normalizeName = (name) => {
      if (!name) return '';
      return name.toLowerCase().trim().replace(/\s+/g, '_');
    };

    // Map balances to payment accounts by matching account names
    const accountBalancesMap = new Map();
    
    // First, try to match by payment account names
    for (const account of paymentAccounts) {
      const normalizedAccountName = normalizeName(account.name);
      let accountBalance = 0;
      
      // Find matching balances
      for (const balance of balances) {
        const normalizedBalanceName = normalizeName(balance.account);
        if (normalizedBalanceName === normalizedAccountName || 
            normalizedBalanceName.includes(normalizedAccountName) ||
            normalizedAccountName.includes(normalizedBalanceName)) {
          accountBalance += parseFloat(balance.balance || 0);
        }
      }
      
      // Use account ID as key for consistency
      accountBalancesMap.set(account.id, accountBalance);
      // Also keep account name for backward compatibility
      accountBalancesMap.set(account.name, accountBalance);
    }

    // Convert back to array format
    const result = Array.from(accountBalancesMap, ([account, balance]) => ({
      account,
      balance
    }));

    return NextResponse.json({ balances: result });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance. Please try again.' },
      { status: 500 }
    );
  }
}
