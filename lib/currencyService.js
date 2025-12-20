// lib/currencyService.js
/**
 * Currency Service
 * Manages currencies and exchange rates for multi-currency support
 */

import prisma from './prisma';

/**
 * Get or create default currencies
 */
export async function initializeDefaultCurrencies() {
  const defaultCurrencies = [
    { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', isBase: true },
    { code: 'USD', name: 'US Dollar', symbol: '$', isBase: false },
    { code: 'EUR', name: 'Euro', symbol: '€', isBase: false },
    { code: 'GBP', name: 'British Pound', symbol: '£', isBase: false },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R', isBase: false }
  ];

  const currencies = [];

  for (const currencyData of defaultCurrencies) {
    let currency = await prisma.currency.findUnique({
      where: { code: currencyData.code }
    });

    if (!currency) {
      currency = await prisma.currency.create({
        data: currencyData
      });
    }

    currencies.push(currency);
  }

  return currencies;
}

/**
 * Get all active currencies
 */
export async function getActiveCurrencies() {
  return await prisma.currency.findMany({
    where: {
      isActive: true
    },
    orderBy: {
      code: 'asc'
    }
  });
}

/**
 * Get exchange rate
 */
export async function getExchangeRate(fromCurrencyCode, toCurrencyCode, date = null, tenantId = null) {
  // Same currency
  if (fromCurrencyCode === toCurrencyCode) {
    return 1.0;
  }

  const effectiveDate = date ? new Date(date) : new Date();

  // Try to find exchange rate
  const fromCurrency = await prisma.currency.findUnique({
    where: { code: fromCurrencyCode }
  });

  const toCurrency = await prisma.currency.findUnique({
    where: { code: toCurrencyCode }
  });

  if (!fromCurrency || !toCurrency) {
    throw new Error('Currency not found');
  }

  // Find most recent exchange rate on or before the date
  const exchangeRate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrencyId: fromCurrency.id,
      toCurrencyId: toCurrency.id,
      effectiveDate: { lte: effectiveDate },
      ...(tenantId && { tenantId })
    },
    orderBy: {
      effectiveDate: 'desc'
    }
  });

  if (exchangeRate) {
    return exchangeRate.rate;
  }

  // Try reverse rate
  const reverseRate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrencyId: toCurrency.id,
      toCurrencyId: fromCurrency.id,
      effectiveDate: { lte: effectiveDate },
      ...(tenantId && { tenantId })
    },
    orderBy: {
      effectiveDate: 'desc'
    }
  });

  if (reverseRate) {
    return 1 / reverseRate.rate;
  }

  // Default: return 1 if no rate found (assume same currency or no conversion needed)
  console.warn(`No exchange rate found for ${fromCurrencyCode} to ${toCurrencyCode}`);
  return 1.0;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(amount, fromCurrencyCode, toCurrencyCode, date = null, tenantId = null) {
  const rate = await getExchangeRate(fromCurrencyCode, toCurrencyCode, date, tenantId);
  return amount * rate;
}

/**
 * Add or update exchange rate
 */
export async function setExchangeRate(fromCurrencyCode, toCurrencyCode, rate, effectiveDate, tenantId = null) {
  const fromCurrency = await prisma.currency.findUnique({
    where: { code: fromCurrencyCode }
  });

  const toCurrency = await prisma.currency.findUnique({
    where: { code: toCurrencyCode }
  });

  if (!fromCurrency || !toCurrency) {
    throw new Error('Currency not found');
  }

  const date = new Date(effectiveDate);
  date.setHours(0, 0, 0, 0);

  // Check if rate already exists for this date
  const existing = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrencyId: fromCurrency.id,
      toCurrencyId: toCurrency.id,
      effectiveDate: date,
      ...(tenantId && { tenantId })
    }
  });

  if (existing) {
    // Update existing rate
    return await prisma.exchangeRate.update({
      where: { id: existing.id },
      data: { rate }
    });
  } else {
    // Create new rate
    return await prisma.exchangeRate.create({
      data: {
        fromCurrencyId: fromCurrency.id,
        toCurrencyId: toCurrency.id,
        rate,
        effectiveDate: date,
        tenantId
      }
    });
  }
}

/**
 * Get base currency for tenant
 */
export async function getBaseCurrency(tenantId) {
  // Check tenant settings first
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId }
  });

  if (settings && settings.currencyCode) {
    const currency = await prisma.currency.findUnique({
      where: { code: settings.currencyCode }
    });
    if (currency) {
      return currency;
    }
  }

  // Default to MWK
  return await prisma.currency.findUnique({
    where: { code: 'MWK' }
  }) || await prisma.currency.findFirst({
    where: { isBase: true }
  });
}










