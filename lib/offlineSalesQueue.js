/**
 * Offline sales queue using IndexedDB.
 * Handles TC-OFF-007 (offline transactions), TC-OFF-008 (time threshold),
 * TC-OFF-009 (amount threshold), and digital signature support.
 */

const DB_NAME = 'insightbooks_offline';
const DB_VERSION = 1;
const STORE_NAME = 'offline_sales';
const CONFIG_STORE = 'offline_config';

// Default thresholds (can be overridden by MRA config)
const DEFAULT_TIME_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const DEFAULT_AMOUNT_THRESHOLD = 5000000; // MWK 5,000,000

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFIG_STORE)) {
        db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate a simple digital signature for offline transactions.
 * Uses a hash of sale data + timestamp + sequence to ensure integrity.
 */
async function generateOfflineSignature(saleData) {
  const payload = JSON.stringify({
    items: saleData.items?.map(i => ({ d: i.description, q: i.quantity, p: i.unitPrice })),
    total: saleData.total,
    timestamp: saleData.offlineTimestamp,
    seq: saleData.offlineSequence,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Queue a sale for later sync */
export async function queueOfflineSale(saleData) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const count = await new Promise((resolve) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
  });

  const offlineTimestamp = new Date().toISOString();
  const offlineSequence = count + 1;
  const signature = await generateOfflineSignature({ ...saleData, offlineTimestamp, offlineSequence });

  const record = {
    saleData: {
      ...saleData,
      offlineTimestamp,
      offlineSequence,
      offlineSignature: signature,
    },
    status: 'pending',
    createdAt: offlineTimestamp,
    attempts: 0,
  };

  await new Promise((resolve, reject) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  db.close();
  return { queued: true, offlineSequence, signature };
}

/** Get all pending offline sales */
export async function getPendingOfflineSales() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('status');

  const sales = await new Promise((resolve) => {
    const req = index.getAll('pending');
    req.onsuccess = () => resolve(req.result);
  });

  db.close();
  return sales;
}

/** Mark a sale as synced */
export async function markSaleSynced(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const record = await new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
  });

  if (record) {
    record.status = 'synced';
    record.syncedAt = new Date().toISOString();
    await new Promise((resolve) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
    });
  }

  db.close();
}

/** Mark a sale as failed */
export async function markSaleFailed(id, error) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const record = await new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
  });

  if (record) {
    record.attempts = (record.attempts || 0) + 1;
    record.lastError = error;
    if (record.attempts >= 3) {
      record.status = 'failed';
    }
    await new Promise((resolve) => {
      const req = store.put(record);
      req.onsuccess = () => resolve();
    });
  }

  db.close();
}

/** Sync all pending offline sales to the server */
export async function syncOfflineSales() {
  const pending = await getPendingOfflineSales();
  const results = { synced: 0, failed: 0, total: pending.length };

  for (const sale of pending) {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale.saleData),
      });

      if (res.ok) {
        await markSaleSynced(sale.id);
        results.synced++;
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        await markSaleFailed(sale.id, err.error || `HTTP ${res.status}`);
        results.failed++;
      }
    } catch (err) {
      await markSaleFailed(sale.id, err.message);
      results.failed++;
    }
  }

  return results;
}

/** Check if offline thresholds are exceeded (TC-OFF-008 time, TC-OFF-009 amount) */
export async function checkOfflineThresholds(config = {}) {
  const timeThreshold = config.offlineTimeThresholdMs || DEFAULT_TIME_THRESHOLD_MS;
  const amountThreshold = config.offlineAmountThreshold || DEFAULT_AMOUNT_THRESHOLD;

  const pending = await getPendingOfflineSales();

  // Time threshold: check oldest pending sale
  if (pending.length > 0) {
    const oldest = pending.reduce((min, s) =>
      new Date(s.createdAt) < new Date(min.createdAt) ? s : min
    , pending[0]);

    const offlineDuration = Date.now() - new Date(oldest.createdAt).getTime();
    if (offlineDuration > timeThreshold) {
      return {
        blocked: true,
        reason: 'time',
        message: `Offline time threshold exceeded. You have been offline for ${Math.round(offlineDuration / 3600000)} hours. Please reconnect to continue selling.`,
      };
    }
  }

  // Amount threshold: sum of pending sales
  const totalAmount = pending.reduce((sum, s) => sum + (Number(s.saleData?.total) || 0), 0);
  if (totalAmount > amountThreshold) {
    return {
      blocked: true,
      reason: 'amount',
      message: `Offline amount threshold exceeded (MK ${totalAmount.toLocaleString()} of MK ${amountThreshold.toLocaleString()} limit). Please reconnect to sync transactions.`,
    };
  }

  return { blocked: false, pendingCount: pending.length, pendingAmount: totalAmount };
}

/** Get offline sales count */
export async function getOfflineSalesCount() {
  try {
    const pending = await getPendingOfflineSales();
    return pending.length;
  } catch {
    return 0;
  }
}
