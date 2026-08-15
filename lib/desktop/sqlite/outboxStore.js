import { OUTBOX_STATUS } from '../outboxState.js';

function rowToOutbox(row) {
  return {
    id: row.id,
    seq: row.seq,
    createdAt: row.createdAt,
    kind: row.kind,
    payload: JSON.parse(row.payloadJson),
    status: row.status,
    errorMessage: row.errorMessage,
    serverId: row.serverId,
  };
}

export function appendOutbox(db, { id, kind, payload }) {
  const maxSeq =
    db.prepare('SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM outbox').get().maxSeq ?? 0;
  const seq = maxSeq + 1;
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(payload ?? {});

  db.prepare(
    `INSERT INTO outbox (id, seq, createdAt, kind, payloadJson, status, errorMessage, serverId)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`
  ).run(id, seq, createdAt, kind, payloadJson, OUTBOX_STATUS.pending);

  return rowToOutbox(
    db.prepare('SELECT * FROM outbox WHERE id = ?').get(id)
  );
}

export function listOutbox(db) {
  const rows = db
    .prepare('SELECT * FROM outbox ORDER BY seq ASC')
    .all();
  return rows.map(rowToOutbox);
}

export function updateOutbox(db, id, patch) {
  const current = db.prepare('SELECT * FROM outbox WHERE id = ?').get(id);
  if (!current) return null;

  const next = {
    status: patch.status ?? current.status,
    errorMessage:
      patch.errorMessage !== undefined ? patch.errorMessage : current.errorMessage,
    serverId: patch.serverId !== undefined ? patch.serverId : current.serverId,
    payloadJson:
      patch.payload !== undefined
        ? JSON.stringify(patch.payload)
        : current.payloadJson,
  };

  db.prepare(
    `UPDATE outbox
     SET status = ?, errorMessage = ?, serverId = ?, payloadJson = ?
     WHERE id = ?`
  ).run(next.status, next.errorMessage, next.serverId, next.payloadJson, id);

  return rowToOutbox(db.prepare('SELECT * FROM outbox WHERE id = ?').get(id));
}

export function listSyncIssues(db) {
  return listOutbox(db).filter((row) => row.status === OUTBOX_STATUS.failed);
}
