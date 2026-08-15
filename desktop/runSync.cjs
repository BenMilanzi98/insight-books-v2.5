const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

function libDesktopRoot() {
  const packagedRoot = path.join(__dirname, 'lib', 'desktop');
  if (fs.existsSync(packagedRoot)) return packagedRoot;
  return path.join(__dirname, '..', 'lib', 'desktop');
}

function importLibDesktop(relativePath) {
  return import(pathToFileURL(path.join(libDesktopRoot(), relativePath)).href);
}

/**
 * CJS wrapper — dynamic-imports ESM sync worker from repo root.
 */
async function runDesktopSyncFromMain({ sqlitePath, cloudUrl, sessionCookie }) {
  const { openDesktopDb } = await importLibDesktop('sqlite/db.js');
  const { createCloudClient } = await importLibDesktop('cloud/createCloudClient.js');
  const { runDesktopSync } = await importLibDesktop('syncWorker.js');

  const db = openDesktopDb(sqlitePath);
  const cookie = sessionCookie ? `session=${sessionCookie}` : undefined;
  const cloud = createCloudClient({ baseUrl: cloudUrl, cookie });
  return runDesktopSync({ db, cloud, now: Date.now() });
}

module.exports = { runDesktopSyncFromMain };
