import { createRequire } from 'node:module';
import { getDesktopSqlitePath } from './userDataPath.js';
import { DESKTOP_SQLITE_SCHEMA } from './schemaEmbedded.js';

const require = createRequire(import.meta.url);

let envDb = null;

function loadBetterSqlite3() {
  try {
    // Native addon — keep out of the webpack graph (see serverExternalPackages).
    return require('better-sqlite3');
  } catch (err) {
    const detail = err?.message || String(err);
    throw new Error(
      `better-sqlite3 is required for desktop offline SQLite (${detail}). ` +
        'Install build tools and run: npm install better-sqlite3'
    );
  }
}

export function openDesktopDb(filePath) {
  const Database = loadBetterSqlite3();
  const db = new Database(filePath);
  db.exec(DESKTOP_SQLITE_SCHEMA);
  return db;
}

export function getDesktopDbFromEnv() {
  if (envDb) return envDb;
  envDb = openDesktopDb(getDesktopSqlitePath());
  return envDb;
}

export function resetDesktopDbFromEnvForTests() {
  envDb = null;
}
