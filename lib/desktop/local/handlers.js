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

function resolveItemPrice(item) {
  return Number(item.unitPrice ?? item.price ?? item.sellingPrice) || 0;
}

function extractPathId(pathname, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pathname.match(new RegExp(`^${escaped}/([^/]+)$`));
  return match ? match[1] : null;
}

function paginate(items, searchParams) {
  const page = parseInt(searchParams.page, 10) || 1;
  const limit = parseInt(searchParams.limit, 10) || 10;
  const totalCount = items.length;
  const skip = (page - 1) * limit;
  return {
    pageItems: items.slice(skip, skip + limit),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 0,
    },
  };
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
    const price = resolveItemPrice(item);
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
      resolvedItems.push({
        ...item,
        price,
        name: product.name,
        productName: product.name,
      });
    } else {
      resolvedItems.push({ ...item, price });
    }
    subtotal += qty * price;
  }

  const saleId = randomUUID();
  const createdAt = new Date(now).toISOString();
  const saleDate = createdAt.split('T')[0];
  let saleNumber;

  const tx = db.transaction(() => {
    for (const item of resolvedItems) {
      if (item.productId) {
        db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(
          Number(item.quantity) || 0,
          item.productId
        );
      }
    }

    saleNumber = allocateDocNumber(db, 'SALE', prefix);

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
  });

  tx();

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
    paymentMethod: body.paymentMethod || 'cash',
    payments: [],
    itemCount: resolvedItems.length,
    customItemCount: resolvedItems.filter((i) => i.isCustom).length,
    eis: null,
    posAmountTendered: body.posAmountTendered ?? null,
    posChangeGiven: body.posChangeGiven ?? null,
  };

  return { status: 201, json: { message: 'Sale created successfully', sale } };
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

function listClients(db, searchParams) {
  const rows = db.prepare('SELECT payload FROM customers').all();
  const clients = rows
    .map((row) => JSON.parse(row.payload))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const { pageItems, pagination } = paginate(clients, searchParams);
  return {
    status: 200,
    json: {
      clients: pageItems,
      pagination: {
        currentPage: pagination.page,
        pageSize: pagination.limit,
        totalItems: pagination.totalCount,
        totalPages: pagination.totalPages,
      },
    },
  };
}

function upsertClientLocal({ db, body, now, user, clientId }) {
  assertWritable(db, now);

  if (!body?.name) {
    return { status: 400, json: { error: 'Name is required' } };
  }

  const id = clientId || randomUUID();
  const createdAt = new Date(now).toISOString();
  const existing = db.prepare('SELECT payload FROM customers WHERE id = ?').get(id);
  const prior = existing ? JSON.parse(existing.payload) : null;

  const client = {
    id,
    name: body.name,
    contactPerson: body.contactPerson ?? prior?.contactPerson ?? null,
    email: body.email ?? prior?.email ?? null,
    additionalEmails: body.additionalEmails ?? prior?.additionalEmails ?? [],
    phone: body.phone ?? prior?.phone ?? null,
    address: body.address ?? prior?.address ?? null,
    isActive: body.isActive ?? prior?.isActive ?? true,
    status: body.status ?? prior?.status ?? 'Active',
    createdAt: prior?.createdAt ?? createdAt,
    updatedAt: createdAt,
    totalBilled: prior?.totalBilled ?? 0,
    totalPaid: prior?.totalPaid ?? 0,
    outstandingAmount: prior?.outstandingAmount ?? 0,
    invoiceCount: prior?.invoiceCount ?? 0,
    salesCount: prior?.salesCount ?? 0,
  };

  const outboxPayload = { ...body, id };

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO customers (id, payload) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload'
    ).run(id, JSON.stringify(client));
    appendOutbox(db, { id: randomUUID(), kind: 'customer.upsert', payload: outboxPayload });
    touchLocalNow(db, now);
  });
  tx();

  const status = clientId ? 200 : 201;
  const message = clientId ? 'Client updated successfully' : 'Client created successfully';
  return { status, json: { message, client } };
}

function listInvoices(db, searchParams) {
  const rows = db.prepare('SELECT payload FROM invoices').all();
  const invoices = rows
    .map((row) => JSON.parse(row.payload))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const { pageItems, pagination } = paginate(invoices, searchParams);
  return { status: 200, json: { invoices: pageItems, pagination } };
}

function createInvoiceLocal({ db, body, now, user }) {
  assertWritable(db, now);

  const meta = readMeta(db);
  const prefix = meta.numberPrefix || 'TILL1';
  const invoiceId = randomUUID();
  const createdAt = new Date(now).toISOString();
  let invoiceNumber;

  const tx = db.transaction(() => {
    invoiceNumber = allocateDocNumber(db, 'INV', prefix);

    const invoice = {
      id: invoiceId,
      invoiceNumber,
      clientId: body.clientId ?? null,
      issueDate: body.issueDate ?? createdAt.split('T')[0],
      dueDate: body.dueDate ?? null,
      status: body.status ?? 'Pending',
      subtotal: Number(body.subtotal ?? 0),
      taxAmount: Number(body.taxAmount ?? 0),
      total: Number(body.total ?? body.subtotal ?? 0),
      totalDiscountAmount: Number(body.totalDiscountAmount ?? 0),
      discount: body.discount ?? 0,
      notes: body.notes ?? null,
      items: body.items ?? [],
      payments: [],
      createdAt,
      createdById: user?.id,
      createdByName: user?.name || 'User',
    };

    db.prepare('INSERT INTO invoices (id, payload) VALUES (?, ?)').run(
      invoiceId,
      JSON.stringify(invoice)
    );
    appendOutbox(db, {
      id: randomUUID(),
      kind: 'invoice.create',
      payload: { ...body, id: invoiceId, invoiceNumber },
    });
    touchLocalNow(db, now);
  });
  tx();

  return {
    status: 201,
    json: {
      message: 'Invoice created successfully',
      invoice: { id: invoiceId, invoiceNumber },
    },
  };
}

function listStock(db, searchParams) {
  const rows = db.prepare('SELECT id, quantity, payload FROM products').all();
  const products = rows
    .map((row) => ({ ...JSON.parse(row.payload), id: row.id, quantity: row.quantity, stockLevel: row.quantity, quantityInStock: row.quantity }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const page = parseInt(searchParams.page, 10) || 1;
  const limitParam = searchParams.limit;
  const limit = limitParam ? (parseInt(limitParam, 10) || 0) : 0;
  const totalCount = products.length;
  const pageItems =
    limit > 0 ? products.slice((page - 1) * limit, (page - 1) * limit + limit) : products;

  return {
    status: 200,
    json: {
      products: pageItems,
      pagination: {
        page: limit > 0 ? page : 1,
        limit: limit > 0 ? limit : totalCount,
        totalCount,
        totalPages: limit > 0 ? Math.ceil(totalCount / limit) || 0 : 1,
      },
    },
  };
}

function adjustStockLocal({ db, productId, body, now }) {
  assertWritable(db, now);

  const quantityRaw = body?.quantity ?? body?.quantityInStock ?? body?.stockLevel;
  if (quantityRaw == null || Number.isNaN(Number(quantityRaw))) {
    return { status: 400, json: { error: 'Quantity is required' } };
  }
  const quantity = Number(quantityRaw);

  const row = db.prepare('SELECT quantity, payload FROM products WHERE id = ?').get(productId);
  if (!row) {
    return { status: 404, json: { error: 'Product not found' } };
  }

  const payload = JSON.parse(row.payload);
  const product = {
    ...payload,
    id: productId,
    quantity,
    stockLevel: quantity,
    quantityInStock: quantity,
  };

  const tx = db.transaction(() => {
    db.prepare('UPDATE products SET quantity = ?, payload = ? WHERE id = ?').run(
      quantity,
      JSON.stringify({ ...payload, stockLevel: quantity, quantityInStock: quantity }),
      productId
    );
    appendOutbox(db, {
      id: randomUUID(),
      kind: 'stock.adjust',
      payload: { ...body, id: productId, productId, quantityInStock: quantity },
    });
    touchLocalNow(db, now);
  });
  tx();

  return { status: 200, json: { message: 'Stock updated successfully', product } };
}

function listPayments(db, searchParams) {
  const rows = db.prepare('SELECT payload FROM payments').all();
  const payments = rows
    .map((row) => JSON.parse(row.payload))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const { pageItems, pagination } = paginate(payments, searchParams);
  return { status: 200, json: { payments: pageItems, pagination } };
}

function createPaymentLocal({ db, body, now, user }) {
  assertWritable(db, now);

  const paymentId = randomUUID();
  const createdAt = new Date(now).toISOString();

  const payment = {
    id: paymentId,
    type: body.type ?? 'Customer Payment',
    invoiceId: body.invoiceId ?? null,
    amount: Number(body.amount ?? 0),
    paymentDate: body.paymentDate ?? createdAt.split('T')[0],
    paymentMethod: body.paymentMethod ?? body.sourceAccount ?? 'cash',
    sourceAccount: body.sourceAccount ?? null,
    destinationAccount: body.destinationAccount ?? null,
    reference: body.reference ?? null,
    notes: body.notes ?? null,
    status: body.status ?? 'Completed',
    createdAt,
    createdById: user?.id,
  };

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO payments (id, payload) VALUES (?, ?)').run(
      paymentId,
      JSON.stringify(payment)
    );
    appendOutbox(db, { id: randomUUID(), kind: 'payment.create', payload: { ...body, id: paymentId } });
    touchLocalNow(db, now);
  });
  tx();

  return { status: 201, json: { message: 'Payment created successfully', payment } };
}

function isImplementedOperationalRoute(method, pathname) {
  if (method === 'GET' && pathname === '/api/sales') return true;
  if (method === 'POST' && pathname === '/api/sales') return true;
  if (method === 'GET' && pathname === '/api/pos/cash-day') return true;
  if (method === 'POST' && pathname === '/api/pos/cash-day/open') return true;
  if (method === 'POST' && pathname === '/api/pos/cash-day/close') return true;
  if (method === 'GET' && pathname === '/api/clients') return true;
  if (method === 'POST' && pathname === '/api/clients') return true;
  if (method === 'PUT' && /^\/api\/clients\/[^/]+$/.test(pathname)) return true;
  if (method === 'GET' && pathname === '/api/invoices') return true;
  if (method === 'POST' && pathname === '/api/invoices') return true;
  if (method === 'GET' && pathname === '/api/stock') return true;
  if (method === 'PATCH' && /^\/api\/stock\/[^/]+$/.test(pathname)) return true;
  if (method === 'GET' && pathname === '/api/payments') return true;
  if (method === 'POST' && pathname === '/api/payments') return true;
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
    if (method === 'GET' && pathname === '/api/clients') {
      return listClients(db, searchParams);
    }
    if (method === 'POST' && pathname === '/api/clients') {
      return upsertClientLocal({ db, body, now, user });
    }
    if (method === 'PUT' && /^\/api\/clients\/[^/]+$/.test(pathname)) {
      return upsertClientLocal({
        db,
        body,
        now,
        user,
        clientId: extractPathId(pathname, '/api/clients'),
      });
    }
    if (method === 'GET' && pathname === '/api/invoices') {
      return listInvoices(db, searchParams);
    }
    if (method === 'POST' && pathname === '/api/invoices') {
      return createInvoiceLocal({ db, body, now, user });
    }
    if (method === 'GET' && pathname === '/api/stock') {
      return listStock(db, searchParams);
    }
    if (method === 'PATCH' && /^\/api\/stock\/[^/]+$/.test(pathname)) {
      return adjustStockLocal({
        db,
        productId: extractPathId(pathname, '/api/stock'),
        body,
        now,
      });
    }
    if (method === 'GET' && pathname === '/api/payments') {
      return listPayments(db, searchParams);
    }
    if (method === 'POST' && pathname === '/api/payments') {
      return createPaymentLocal({ db, body, now, user });
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
