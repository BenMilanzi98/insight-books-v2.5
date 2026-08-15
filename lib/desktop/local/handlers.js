import { randomUUID } from 'node:crypto';
import { classifyDesktopApiPath } from '../paths.js';
import { DESKTOP_CODES } from '../codes.js';
import { formatDesktopDocNumber, nextSeq } from '../documentNumbers.js';
import { readMeta, writeMeta } from '../sqlite/meta.js';
import { getProduct } from '../sqlite/snapshotStore.js';
import { appendOutbox } from '../sqlite/outboxStore.js';
import { assertWritable, touchLocalNow } from './writeGate.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getSnapshotJson(db, entity) {
  const row = db.prepare('SELECT payload FROM snapshot_json WHERE entity = ?').get(entity);
  return row ? JSON.parse(row.payload) : null;
}

function setSnapshotJson(db, entity, payload) {
  db.prepare(
    'INSERT INTO snapshot_json (entity, payload) VALUES (?, ?) ON CONFLICT(entity) DO UPDATE SET payload = excluded.payload'
  ).run(entity, JSON.stringify(payload ?? null));
}

function syncRequiredResponse() {
  return {
    status: 403,
    json: { error: 'Sync required', code: DESKTOP_CODES.SYNC_REQUIRED },
  };
}

function notImplementedResponse(pathname) {
  return {
    status: 501,
    json: { error: 'Not implemented locally', pathname },
  };
}

function allocateDocNumber(db, docType, prefix) {
  const row = db.prepare('SELECT lastIssued FROM doc_counters WHERE type = ?').get(docType);
  const seq = nextSeq(row?.lastIssued);
  db.prepare(
    'INSERT INTO doc_counters (type, lastIssued) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET lastIssued = excluded.lastIssued'
  ).run(docType, seq);
  return formatDesktopDocNumber({ prefix, type: docType, seq });
}

function listSales(db, searchParams) {
  const page = parseInt(searchParams.page, 10) || 1;
  const limit = parseInt(searchParams.limit, 10) || 10;
  const rows = db.prepare('SELECT payload FROM sales').all();
  const sales = rows
    .map((row) => JSON.parse(row.payload))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const totalCount = sales.length;
  const skip = (page - 1) * limit;
  const pageSales = sales.slice(skip, skip + limit);

  const formattedSales = pageSales.map((sale) => ({
    id: sale.id,
    saleNumber: sale.saleNumber,
    date: sale.date,
    client: sale.clientName || 'Walk-in Customer',
    clientId: sale.clientId ?? null,
    createdBy: sale.createdByName || 'User',
    productSummary: (sale.items || [])
      .map((item) => `${item.name || item.productName || 'Item'} (x${item.quantity})`)
      .join(', ') || 'Items listed',
    subtotal: Number(sale.subtotal ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    taxAmount: Number(sale.taxAmount ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    total: Number(sale.total ?? 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    discount: sale.discount ?? null,
    taxRate: sale.taxRate ?? null,
    status: sale.status || 'completed',
    paymentMethod: sale.paymentMethod || 'cash',
    notes: sale.notes ?? null,
    itemCount: (sale.items || []).length,
    createdAt: sale.createdAt,
    rawTotal: sale.total ?? 0,
    rawSubtotal: sale.subtotal ?? 0,
  }));

  return {
    status: 200,
    json: {
      sales: formattedSales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 0,
      },
    },
  };
}

function createSaleLocal({ db, body, now, user }) {
  assertWritable(db, now);

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 400, json: { error: 'Sale must include at least one item' } };
  }

  const meta = readMeta(db);
  const prefix = meta.numberPrefix || 'TILL1';
  let subtotal = 0;
  const resolvedItems = [];

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    if (qty <= 0) {
      return { status: 400, json: { error: 'Invalid item quantity' } };
    }

    if (item.productId) {
      const product = getProduct(db, item.productId);
      if (!product) {
        return { status: 400, json: { error: `Product not found: ${item.productId}` } };
      }
      if (product.quantity < qty) {
        return { status: 400, json: { error: `Insufficient stock for ${product.name || item.productId}` } };
      }
      db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(qty, item.productId);
      resolvedItems.push({
        ...item,
        name: product.name,
        productName: product.name,
      });
    } else {
      resolvedItems.push(item);
    }
    subtotal += qty * price;
  }

  const saleNumber = allocateDocNumber(db, 'SALE', prefix);
  const saleId = randomUUID();
  const createdAt = new Date(now).toISOString();
  const saleDate = createdAt.split('T')[0];

  const saleRecord = {
    id: saleId,
    saleNumber,
    date: saleDate,
    subtotal,
    taxAmount: 0,
    total: subtotal,
    status: 'completed',
    paymentMethod: body.paymentMethod || 'cash',
    items: resolvedItems,
    clientId: body.clientId ?? null,
    clientName: body.clientName ?? null,
    notes: body.notes ?? null,
    createdAt,
    createdById: user?.id,
    createdByName: user?.name || 'User',
  };

  db.prepare('INSERT INTO sales (id, payload) VALUES (?, ?)').run(saleId, JSON.stringify(saleRecord));

  const outboxPayload = { ...body, saleNumber };
  appendOutbox(db, { id: randomUUID(), kind: 'pos.sale', payload: outboxPayload });
  touchLocalNow(db, now);

  const sale = {
    id: saleId,
    saleNumber,
    date: saleDate,
    subtotal,
    totalTaxAmount: 0,
    totalDiscountAmount: 0,
    tax: 0,
    total: subtotal,
    status: 'completed',
    paymentMethod: saleRecord.paymentMethod,
    payments: [],
    itemCount: resolvedItems.length,
    customItemCount: resolvedItems.filter((i) => i.isCustom).length,
    eis: null,
    posAmountTendered: body.posAmountTendered ?? null,
    posChangeGiven: body.posChangeGiven ?? null,
  };

  return { status: 200, json: { sale } };
}

function getCashDayLocal(db, searchParams) {
  const posConfig = getSnapshotJson(db, 'posConfig') || {};
  const cashDay = posConfig.cashDay || null;
  const businessDate = searchParams.date || new Date().toISOString().slice(0, 10);
  const tillOpen = cashDay?.status === 'OPEN';
  const tillClosed = cashDay?.status === 'CLOSED';

  return {
    status: 200,
    json: {
      businessDate,
      branchKey: posConfig.branchKey || 'none',
      systemCashAccount: posConfig.systemCashAccount ?? null,
      liveCashBalance: cashDay?.liveCashBalance ?? 0,
      register: cashDay,
      tillOpen,
      tillClosed,
      requiresTillOpen: !tillOpen,
      suggestedOpeningBalance: cashDay?.openingBalance ?? 0,
      tillFloatAccount: posConfig.tillFloatAccount ?? null,
      canReopen: tillClosed,
      fundingPreview: posConfig.fundingPreview ?? {
        cashAvailable: 0,
        capitalFallback: true,
        note: 'Entered float is funded from Cash first; any shortfall comes from Owner Capital.',
      },
      metrics: cashDay?.metrics ?? {
        openingBalance: 0,
        totalSales: 0,
        totalCashSales: 0,
        depositsSum: 0,
        closingBalance: 0,
        cashInHandUndeposited: 0,
        cashInHandTotalCashMinusOpening: 0,
      },
    },
  };
}

function openCashDayLocal({ db, body, now, user }) {
  assertWritable(db, now);

  const posConfig = getSnapshotJson(db, 'posConfig') || {};
  const businessDate = body.businessDate || new Date(now).toISOString().slice(0, 10);
  const openingBalance = body.openingBalance != null && body.openingBalance !== ''
    ? Number(body.openingBalance)
    : 0;

  const register = {
    id: randomUUID(),
    status: 'OPEN',
    businessDate,
    openingBalance,
    openedAt: new Date(now).toISOString(),
    openedById: user?.id,
    liveCashBalance: openingBalance,
    metrics: {
      openingBalance,
      totalSales: 0,
      totalCashSales: 0,
      depositsSum: 0,
      closingBalance: openingBalance,
      cashInHandUndeposited: 0,
      cashInHandTotalCashMinusOpening: 0,
    },
  };

  setSnapshotJson(db, 'posConfig', { ...posConfig, cashDay: register });
  appendOutbox(db, {
    id: randomUUID(),
    kind: 'pos.cashDay.open',
    payload: { businessDate, openingBalance },
  });
  touchLocalNow(db, now);

  return { status: 200, json: { success: true, register } };
}

function closeCashDayLocal({ db, body, now, user }) {
  assertWritable(db, now);

  const posConfig = getSnapshotJson(db, 'posConfig') || {};
  const cashDay = posConfig.cashDay;
  if (!cashDay || cashDay.status !== 'OPEN') {
    return { status: 400, json: { error: 'Till is not open', code: 'NOT_OPEN' } };
  }

  const businessDate = body.businessDate || cashDay.businessDate;
  const register = {
    ...cashDay,
    status: 'CLOSED',
    businessDate,
    closedAt: new Date(now).toISOString(),
    closedById: user?.id,
  };

  setSnapshotJson(db, 'posConfig', { ...posConfig, cashDay: register });
  appendOutbox(db, {
    id: randomUUID(),
    kind: 'pos.cashDay.close',
    payload: { businessDate },
  });
  touchLocalNow(db, now);

  return { status: 200, json: { success: true, register } };
}

function isImplementedOperationalRoute(method, pathname) {
  if (method === 'GET' && pathname === '/api/sales') return true;
  if (method === 'POST' && pathname === '/api/sales') return true;
  if (method === 'GET' && pathname === '/api/pos/cash-day') return true;
  if (method === 'POST' && pathname === '/api/pos/cash-day/open') return true;
  if (method === 'POST' && pathname === '/api/pos/cash-day/close') return true;
  return false;
}

export function handleDesktopLocal({ db, method, pathname, searchParams = {}, body, now, user }) {
  const classification = classifyDesktopApiPath(pathname);

  if (classification !== 'operational') {
    return { status: 404, json: { error: 'Not found' } };
  }

  if (WRITE_METHODS.has(method) && !isImplementedOperationalRoute(method, pathname)) {
    try {
      assertWritable(db, now);
    } catch {
      return syncRequiredResponse();
    }
    return notImplementedResponse(pathname);
  }

  try {
    if (method === 'GET' && pathname === '/api/sales') {
      return listSales(db, searchParams);
    }
    if (method === 'POST' && pathname === '/api/sales') {
      return createSaleLocal({ db, body, now, user });
    }
    if (method === 'GET' && pathname === '/api/pos/cash-day') {
      return getCashDayLocal(db, searchParams);
    }
    if (method === 'POST' && pathname === '/api/pos/cash-day/open') {
      return openCashDayLocal({ db, body, now, user });
    }
    if (method === 'POST' && pathname === '/api/pos/cash-day/close') {
      return closeCashDayLocal({ db, body, now, user });
    }

    if (WRITE_METHODS.has(method)) {
      return notImplementedResponse(pathname);
    }

    return notImplementedResponse(pathname);
  } catch (err) {
    if (err?.code === DESKTOP_CODES.SYNC_REQUIRED) {
      return syncRequiredResponse();
    }
    return { status: err?.status || 500, json: { error: err?.message || 'Internal error' } };
  }
}
