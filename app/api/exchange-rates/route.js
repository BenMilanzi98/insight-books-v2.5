// app/api/exchange-rates/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getExchangeRate, setExchangeRate, convertCurrency } from '@/lib/currencyService';
import prisma from '@/lib/prisma';

// GET - Get exchange rates
export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get('from');
    const toCurrency = searchParams.get('to');
    const date = searchParams.get('date');

    if (fromCurrency && toCurrency) {
      // Get specific exchange rate
      const rate = await getExchangeRate(fromCurrency, toCurrency, date, user.tenantId);
      return NextResponse.json({
        success: true,
        data: {
          fromCurrency,
          toCurrency,
          rate,
          date: date || new Date().toISOString().split('T')[0]
        }
      });
    }

    // Get all exchange rates
    const exchangeRates = await prisma.exchangeRate.findMany({
      where: {
        ...(user.tenantId && { tenantId: user.tenantId })
      },
      include: {
        fromCurrency: {
          select: {
            code: true,
            name: true,
            symbol: true
          }
        },
        toCurrency: {
          select: {
            code: true,
            name: true,
            symbol: true
          }
        }
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: exchangeRates
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

// POST - Add or update exchange rate
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
    const { fromCurrency, toCurrency, rate, effectiveDate } = body;

    if (!fromCurrency || !toCurrency || rate === undefined || !effectiveDate) {
      return NextResponse.json(
        { error: 'From currency, to currency, rate, and effective date are required' },
        { status: 400 }
      );
    }

    if (rate <= 0) {
      return NextResponse.json(
        { error: 'Exchange rate must be greater than zero' },
        { status: 400 }
      );
    }

    const exchangeRate = await setExchangeRate(
      fromCurrency,
      toCurrency,
      rate,
      effectiveDate,
      user.tenantId
    );

    return NextResponse.json({
      success: true,
      message: 'Exchange rate saved successfully',
      data: exchangeRate
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving exchange rate:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save exchange rate' },
      { status: 500 }
    );
  }
}

// POST - Convert currency amount
export async function PUT(request) {
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
    const { amount, fromCurrency, toCurrency, date } = body;

    if (amount === undefined || !fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: 'Amount, from currency, and to currency are required' },
        { status: 400 }
      );
    }

    const convertedAmount = await convertCurrency(
      amount,
      fromCurrency,
      toCurrency,
      date,
      user.tenantId
    );

    const rate = await getExchangeRate(fromCurrency, toCurrency, date, user.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        originalAmount: amount,
        fromCurrency,
        toCurrency,
        convertedAmount,
        exchangeRate: rate,
        date: date || new Date().toISOString().split('T')[0]
      }
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to convert currency' },
      { status: 500 }
    );
  }
}










