// app/api/currencies/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getActiveCurrencies, initializeDefaultCurrencies } from '@/lib/currencyService';
import prisma from '@/lib/prisma';

// GET - List all currencies
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const currencies = await getActiveCurrencies();

    // If no currencies exist, initialize defaults
    if (currencies.length === 0) {
      await initializeDefaultCurrencies();
      const newCurrencies = await getActiveCurrencies();
      return NextResponse.json({
        success: true,
        data: newCurrencies,
        message: 'Default currencies initialized'
      });
    }

    return NextResponse.json({
      success: true,
      data: currencies
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch currencies' },
      { status: 500 }
    );
  }
}

// POST - Create new currency
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, name, symbol, isBase = false } = body;

    if (!code || !name || !symbol) {
      return NextResponse.json(
        { error: 'Code, name, and symbol are required' },
        { status: 400 }
      );
    }

    // Check if currency already exists
    const existing = await prisma.currency.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Currency with this code already exists' },
        { status: 400 }
      );
    }

    // If setting as base, unset other base currencies
    if (isBase) {
      await prisma.currency.updateMany({
        where: { isBase: true },
        data: { isBase: false }
      });
    }

    const currency = await prisma.currency.create({
      data: {
        code: code.toUpperCase(),
        name,
        symbol,
        isBase
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Currency created successfully',
      data: currency
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating currency:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create currency' },
      { status: 500 }
    );
  }
}










