import { readMeta, writeMeta } from '../sqlite/meta.js';
import { evaluateDesktopLock } from '../lock.js';
import { DESKTOP_CODES } from '../codes.js';

export function assertWritable(db, now) {
  const meta = readMeta(db);
  const lock = evaluateDesktopLock({
    lastSuccessfulSyncAt: meta.lastSuccessfulSyncAt,
    lastLocalNow: meta.lastLocalNow,
    now,
    subscriptionActive: meta.subscriptionActive !== 'false',
  });
  if (lock.locked) {
    const err = new Error('Sync required');
    err.code = DESKTOP_CODES.SYNC_REQUIRED;
    err.status = 403;
    throw err;
  }
}

export function touchLocalNow(db, now) {
  writeMeta(db, { lastLocalNow: String(now) });
}
