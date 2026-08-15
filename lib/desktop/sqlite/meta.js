const META_KEYS = [
  'tenantId',
  'deviceId',
  'numberPrefix',
  'lastSuccessfulSyncAt',
  'lastServerNow',
  'lastLocalNow',
  'boundAt',
  'subscriptionActive',
];

export function readMeta(db) {
  const rows = db.prepare('SELECT k, v FROM meta').all();
  const map = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  const meta = {};
  for (const key of META_KEYS) {
    meta[key] = map[key] ?? null;
  }
  return meta;
}

export function writeMeta(db, patch) {
  const upsert = db.prepare(
    'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (v === undefined) continue;
      upsert.run(k, v === null ? '' : String(v));
    }
  });
  tx(Object.entries(patch));
}
