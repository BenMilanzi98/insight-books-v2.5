import { writeMeta } from './meta.js';

const SNAPSHOT_ENTITY_TABLES = [
  'products',
  'customers',
  'invoices',
  'sales',
  'payments',
  'snapshot_json',
  'doc_counters',
];

function setSnapshotJson(db, entity, payload) {
  db.prepare(
    'INSERT INTO snapshot_json (entity, payload) VALUES (?, ?) ON CONFLICT(entity) DO UPDATE SET payload = excluded.payload'
  ).run(entity, JSON.stringify(payload ?? null));
}

export function getProduct(db, id) {
  const row = db.prepare('SELECT quantity, payload FROM products WHERE id = ?').get(id);
  if (!row) return null;
  return { ...JSON.parse(row.payload), quantity: row.quantity };
}

export function replaceSnapshot(db, snapshot) {
  const insertProduct = db.prepare(
    'INSERT INTO products (id, quantity, payload) VALUES (?, ?, ?)'
  );
  const insertCustomer = db.prepare(
    'INSERT INTO customers (id, payload) VALUES (?, ?)'
  );
  const insertInvoice = db.prepare(
    'INSERT INTO invoices (id, payload) VALUES (?, ?)'
  );
  const insertPayment = db.prepare(
    'INSERT INTO payments (id, payload) VALUES (?, ?)'
  );

  const tx = db.transaction(() => {
    for (const table of SNAPSHOT_ENTITY_TABLES) {
      db.prepare(`DELETE FROM ${table}`).run();
    }

    for (const product of snapshot.products || []) {
      const { id, quantity, ...rest } = product;
      insertProduct.run(id, Number(quantity ?? 0), JSON.stringify(rest));
    }

    for (const customer of snapshot.customers || []) {
      const { id, ...rest } = customer;
      insertCustomer.run(id, JSON.stringify({ id, ...rest }));
    }

    for (const invoice of snapshot.openInvoices || []) {
      insertInvoice.run(invoice.id, JSON.stringify(invoice));
    }

    for (const payment of snapshot.recentPayments || []) {
      insertPayment.run(payment.id, JSON.stringify(payment));
    }

    setSnapshotJson(db, 'taxTypes', snapshot.taxTypes || []);
    setSnapshotJson(db, 'paymentAccounts', snapshot.paymentAccounts || []);
    setSnapshotJson(db, 'sessionUser', snapshot.sessionUser || null);
    setSnapshotJson(db, 'tenantSettings', snapshot.tenantSettings || {});
    setSnapshotJson(db, 'posConfig', snapshot.posConfig || {});
    setSnapshotJson(db, 'version', snapshot.version ?? 1);

    writeMeta(db, {
      tenantId: snapshot.tenantId,
      lastServerNow: snapshot.serverNow,
    });
  });

  tx();
}
