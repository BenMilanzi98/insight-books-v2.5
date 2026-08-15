export const OUTBOX_STATUS = {
  pending: 'pending',
  syncing: 'syncing',
  failed: 'failed',
  synced: 'synced',
};

export function sortOutboxForPush(rows) {
  return [...rows].sort((a, b) => a.seq - b.seq);
}

export function nextPushItem(rows) {
  const sorted = sortOutboxForPush(rows);
  for (const row of sorted) {
    if (row.status === 'synced') continue;
    if (row.status === 'failed') return null;
    if (row.status === 'pending' || row.status === 'syncing') return row;
  }
  return null;
}

export function canPullSnapshot(rows) {
  return rows.every((r) => r.status === 'synced');
}

export function markPushFailure(rows, id, errorMessage) {
  return rows.map((r) =>
    r.id === id ? { ...r, status: 'failed', errorMessage } : r
  );
}

export function markPushSuccess(rows, id, serverId) {
  return rows.map((r) =>
    r.id === id ? { ...r, status: 'synced', serverId } : r
  );
}
