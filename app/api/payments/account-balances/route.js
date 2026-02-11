// app/api/account-balances/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getAccountForPaymentMethod } from '@/lib/paymentMethodAccountMapping';

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

    // Payment method keys that need balances
    const paymentMethodKeys = ['cash', 'bank_transfer', 'airtel_money', 'mpamba', 'paychangu'];
    
    // Fetch account balances for the current tenant
    const accountBalances = await prisma.accountBalance.findMany({
      where: { tenantId: user.tenantId }
    });

    // Create a map of account identifiers to balances
    const balanceMap = new Map();
    for (const balance of accountBalances) {
      // Store by account name/identifier
      balanceMap.set(balance.account.toLowerCase().trim(), parseFloat(balance.balance || 0));
    }

    // Also get balances from Account model directly
    const accounts = await prisma.account.findMany({
      where: {
        tenantId: user.tenantId,
        accountType: 'Asset',
        isActive: true
      },
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        balance: true
      }
    });

    // Add account balances to the map
    for (const account of accounts) {
      const accountKey = (account.accountName || account.accountCode || '').toLowerCase().trim();
      if (accountKey) {
        const currentBalance = balanceMap.get(accountKey) || 0;
        balanceMap.set(accountKey, currentBalance + parseFloat(account.balance || 0));
      }
    }

    // Map payment methods to their account balances
    const result = [];
    for (const methodKey of paymentMethodKeys) {
      try {
        const account = await getAccountForPaymentMethod(user.tenantId, methodKey);
        if (account) {
          // Try multiple ways to find the balance
          const accountName = (account.accountName || account.name || '').toLowerCase().trim();
          const accountCode = (account.accountCode || account.code || '').toLowerCase().trim();
          
          // Look up balance by account name or code in the balance map
          let balance = 0;
          if (accountName) {
            balance = balanceMap.get(accountName) || 0;
          }
          if (balance === 0 && accountCode) {
            balance = balanceMap.get(accountCode) || 0;
          }
          
          // Also check AccountBalance records directly
          if (balance === 0) {
            const accountBalanceRecord = accountBalances.find(b => {
              const balanceAccount = (b.account || '').toLowerCase().trim();
              return balanceAccount === accountName || 
                     balanceAccount === accountCode ||
                     balanceAccount.includes(accountName) ||
                     accountName.includes(balanceAccount);
            });
            if (accountBalanceRecord) {
              balance = parseFloat(accountBalanceRecord.balance || 0);
            }
          }
          
          // Fallback to account.balance from Account model (most reliable)
          if (balance === 0 && account.balance !== undefined && account.balance !== null) {
            balance = parseFloat(account.balance || 0);
          }

          result.push({
            account: methodKey, // Use payment method key for component lookup
            balance: balance
          });
        } else {
          // Account not found, return 0 balance
          result.push({
            account: methodKey,
            balance: 0
          });
        }
      } catch (error) {
        console.warn(`Error getting account for payment method ${methodKey}:`, error);
        // Still include the method with 0 balance
        result.push({
          account: methodKey,
          balance: 0
        });
      }
    }

    return NextResponse.json({ balances: result });
  } catch (error) {
    console.error('Error fetching balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance. Please try again.' },
      { status: 500 }
    );
  }
}
