import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDesktopSqlitePath } from './userDataPath.js';

const require = createRequire(import.meta.url);

let _schemaSql;
function getSchemaSql() {
  if (!_schemaSql) {
    const dir = dirname(fileURLToPath(import.meta.url));
    _schemaSql = readFileSync(join(dir, 'schema.sql'), 'utf8');
  }
  return _schemaSql;
}

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
  db.exec(getSchemaSql());
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
