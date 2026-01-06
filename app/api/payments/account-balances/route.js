// app/api/account-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { paymentMethods } from '@/lib/paymentMethods';

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

    // Fetch account balances for the current tenant
    const balances = await prisma.accountBalance.findMany({
      where: { tenantId: user.tenantId },
      select: {
        account: true,
        balance: true
      }
    });

    // Helper to normalize payment method names
    const normalizePaymentMethod = (method) => {
      if (!method) return '';
      const methodStr = method.toString().trim();
      if (methodStr.includes('_')) {
        return methodStr.toLowerCase();
      }
      return methodStr.toLowerCase().replace(/\s+/g, '_');
    };

    // Normalize payment method names in balances and merge duplicates
    const normalizedBalances = new Map();
    for (const balance of balances) {
      const accountKey = balance.account;
      // Check if it's already a normalized payment method key
      if (paymentMethods.some(pm => pm.key === accountKey)) {
        normalizedBalances.set(accountKey, balance.balance);
      } else {
        // Try normalizing it
        const normalized = normalizePaymentMethod(accountKey);
        if (paymentMethods.some(pm => pm.key === normalized)) {
          // If normalized version exists, merge with existing balance or set new
          const existingBalance = normalizedBalances.get(normalized) || 0;
          normalizedBalances.set(normalized, existingBalance + parseFloat(balance.balance || 0));
        } else {
          // Not a payment method, keep as is (might be an account ID)
          normalizedBalances.set(accountKey, balance.balance);
        }
      }
    }

    // Convert back to array format
    const result = Array.from(normalizedBalances, ([account, balance]) => ({
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
