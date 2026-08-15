/**
 * CJS wrapper — dynamic-imports ESM sync worker from repo root.
 */
async function runDesktopSyncFromMain({ sqlitePath, cloudUrl, sessionCookie }) {
  const { openDesktopDb } = await import('../lib/desktop/sqlite/db.js');
  const { createCloudClient } = await import('../lib/desktop/cloud/createCloudClient.js');
  const { runDesktopSync } = await import('../lib/desktop/syncWorker.js');

  const db = openDesktopDb(sqlitePath);
  const cookie = sessionCookie ? `session=${sessionCookie}` : undefined;
  const cloud = createCloudClient({ baseUrl: cloudUrl, cookie });
  return runDesktopSync({ db, cloud, now: Date.now() });
}

module.exports = { runDesktopSyncFromMain };
