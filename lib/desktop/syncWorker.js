import { DESKTOP_CODES } from './codes.js';
import { evaluateDesktopLock } from './lock.js';
import {
  nextPushItem,
  canPullSnapshot,
  markPushFailure,
  markPushSuccess,
  OUTBOX_STATUS,
} from './outboxState.js';
import { readMeta, writeMeta } from './sqlite/meta.js';
import { listOutbox, updateOutbox } from './sqlite/outboxStore.js';
import { replaceSnapshot } from './sqlite/snapshotStore.js';

function persistOutboxRows(db, rows) {
  for (const row of rows) {
    updateOutbox(db, row.id, {
      status: row.status,
      errorMessage: row.errorMessage,
      serverId: row.serverId,
    });
  }
}

function toPushItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    payload: row.payload,
  };
}

export async function runDesktopSync({ db, cloud, now }) {
  const meta = readMeta(db);
  const deviceId = meta.deviceId;

  const heartbeat = await cloud.heartbeat({ deviceId });

  if (!heartbeat.bound) {
    return { ok: false, error: DESKTOP_CODES.NOT_BOUND };
  }

  writeMeta(db, {
    subscriptionActive: String(heartbeat.subscriptionActive),
  });

  if (!heartbeat.subscriptionActive) {
    return { ok: false, error: DESKTOP_CODES.SUBSCRIPTION_INACTIVE };
  }

  const serverNow = heartbeat.serverNow;
  let rows = listOutbox(db);

  while (true) {
    const item = nextPushItem(rows);
    if (!item) break;

    updateOutbox(db, item.id, { status: OUTBOX_STATUS.syncing });
    rows = listOutbox(db);

    const pushResult = await cloud.pushItems({
      deviceId,
      items: [toPushItem(item)],
    });

    if (pushResult.error || pushResult.stoppedAt) {
      const failedId = pushResult.stoppedAt || item.id;
      rows = markPushFailure(rows, failedId, pushResult.error || 'Push failed');
      persistOutboxRows(db, rows);
      return {
        ok: false,
        error: pushResult.error,
        failedItemId: failedId,
      };
    }

    const result = pushResult.results?.[0];
    if (!result?.id) {
      rows = markPushFailure(rows, item.id, 'Missing push result');
      persistOutboxRows(db, rows);
      return { ok: false, error: 'Missing push result', failedItemId: item.id };
    }

    rows = markPushSuccess(rows, result.id, result.serverId);
    persistOutboxRows(db, rows);
  }

  rows = listOutbox(db);
  if (!canPullSnapshot(rows)) {
    return { ok: true };
  }

  const snapshot = await cloud.pullSnapshot({ deviceId });
  replaceSnapshot(db, snapshot);

  const lastSuccessfulSyncAt = Date.parse(serverNow);
  writeMeta(db, {
    lastSuccessfulSyncAt: String(lastSuccessfulSyncAt),
    lastServerNow: serverNow,
    lastLocalNow: String(now),
  });

  return { ok: true, lastSuccessfulSyncAt };
}

export function syncStatusFromDb(db, now) {
  const meta = readMeta(db);
  const rows = listOutbox(db);
  const subscriptionActive =
    meta.subscriptionActive === null ? true : meta.subscriptionActive === 'true';

  const lock = evaluateDesktopLock({
    lastSuccessfulSyncAt: meta.lastSuccessfulSyncAt,
    lastLocalNow: meta.lastLocalNow,
    now,
    subscriptionActive,
  });

  const pendingCount = rows.filter(
    (r) => r.status === OUTBOX_STATUS.pending || r.status === OUTBOX_STATUS.syncing
  ).length;
  const failedCount = rows.filter((r) => r.status === OUTBOX_STATUS.failed).length;

  return {
    locked: lock.locked,
    warning: lock.warning,
    hoursSinceSync: lock.hoursSinceSync,
    lastSuccessfulSyncAt: meta.lastSuccessfulSyncAt
      ? Number(meta.lastSuccessfulSyncAt)
      : null,
    pendingCount,
    failedCount,
  };
}
